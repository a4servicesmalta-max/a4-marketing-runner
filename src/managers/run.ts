import "../ws-polyfill.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Config } from "../config.js";
import { MANAGERS, type DeptManager } from "./playbooks.js";

export interface ManagerSummary {
  dept: string;
  skipped?: boolean;
  reason?: string;
  tasksCreated: number;
  assigned: number;
}

interface Member { id: string; name: string; jobRole: string; }
interface PlannedTask { title: string; description: string; assignee: string | null; priority: "High" | "Med" | "Low"; dueLabel: string; }

function tzParts(tz: string): { date: string; hour: number; weekday: string } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "long" });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date())) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: parseInt(p.hour, 10), weekday: p.weekday };
}

async function loadTeam(supa: SupabaseClient, teamName: string): Promise<Member[]> {
  const { data: team } = await supa.from("teams").select("id").eq("name", teamName).maybeSingle();
  if (!team) return [];
  const { data } = await supa.from("profiles").select("id,full_name,job_role").eq("team_id", team.id).eq("status", "Active");
  return (data ?? []).map((p) => ({ id: p.id as string, name: p.full_name as string, jobRole: (p.job_role as string) ?? "" }));
}

async function openTaskTitles(supa: SupabaseClient): Promise<string[]> {
  const { data } = await supa.from("tasks").select("title").eq("done", false).limit(60);
  return (data ?? []).map((t) => t.title as string);
}

function parseTasks(text: string): PlannedTask[] {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 8).map((o) => ({
      title: String(o.title ?? "").slice(0, 80),
      description: String(o.description ?? "").slice(0, 1200),
      assignee: o.assignee == null ? null : String(o.assignee),
      priority: ["High", "Med", "Low"].includes(o.priority) ? o.priority : "Med",
      dueLabel: String(o.dueLabel ?? "today").slice(0, 40),
    })).filter((t) => t.title);
  } catch { return []; }
}

async function generatePlan(mgr: DeptManager, members: Member[], openTitles: string[], when: { date: string; weekday: string }): Promise<PlannedTask[]> {
  const team = members.length
    ? members.map((m) => `- ${m.name} (${m.jobRole})`).join("\n")
    : "(no team members assigned yet — set assignee to null; create a department to-do list)";
  const prompt = `You are the ${mgr.label} manager at A4 Services, an audit/accounting firm in Malta. Today is ${when.weekday}, ${when.date}.

Your team:
${team}

Standing playbook (recurring duties):
${mgr.playbook.map((p) => `- ${p}`).join("\n")}

Already-open tasks on the board (do NOT duplicate these):
${openTitles.length ? openTitles.map((t) => `- ${t}`).join("\n") : "(none)"}

Produce TODAY's task list for the ${mgr.label} team. Be realistic and specific to today (3–7 tasks), each a concrete action with one owner. Pick "assignee" as an exact full name from the team list above, or null if there are no members or it's a whole-team item. Honour weekday-specific duties.
Respond with ONLY a JSON array, no prose:
[{"title":"<imperative, <=80 chars>","description":"<what + any context>","assignee":"<full name or null>","priority":"High|Med|Low","dueLabel":"today|by Fri|..."}]`;

  let text = "";
  for await (const m of query({ prompt, options: { allowedTools: [], maxTurns: 1 } })) {
    if (m.type === "result" && m.subtype === "success" && typeof m.result === "string") text = m.result;
  }
  return parseTasks(text);
}

export async function runManager(cfg: Config, mgr: DeptManager, opts: { force?: boolean } = {}): Promise<ManagerSummary> {
  const supa = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { date } = tzParts(cfg.MANAGERS_TZ);

  if (!opts.force) {
    const { data: already } = await supa.from("manager_runs").select("id").eq("dept", mgr.id).eq("run_date", date).maybeSingle();
    if (already) return { dept: mgr.id, skipped: true, reason: "already ran today", tasksCreated: 0, assigned: 0 };
  }

  const members = await loadTeam(supa, mgr.teamName);
  const openTitles = await openTaskTitles(supa);
  const plan = await generatePlan(mgr, members, openTitles, tzParts(cfg.MANAGERS_TZ));

  const byName = new Map(members.map((m) => [m.name.toLowerCase(), m.id]));
  let created = 0, assigned = 0;
  for (let i = 0; i < plan.length; i++) {
    const t = plan[i];
    const assigneeId = t.assignee ? byName.get(t.assignee.toLowerCase()) ?? null : null;
    if (assigneeId) assigned++;
    const { error } = await supa.from("tasks").insert({
      id: `task_${mgr.id}_${date}_${i}`,
      title: t.title,
      description: `${t.description}\n\n— ${mgr.label} daily plan, ${date}`,
      team: mgr.teamName,
      assignee_id: assigneeId,
      status: "To do",
      priority: t.priority,
      due_label: t.dueLabel,
      tag: `Daily-${mgr.label}`,
      done: false,
    });
    if (!error) created++;
    else console.error(`[mgr:${mgr.id}] insert failed:`, error.message);
  }

  await supa.from("manager_runs").upsert({ dept: mgr.id, run_date: date, tasks_created: created }, { onConflict: "dept,run_date" });
  console.log(`[mgr:${mgr.id}] ${date}: ${created} tasks (${assigned} assigned, ${members.length} members)`);
  return { dept: mgr.id, tasksCreated: created, assigned };
}

/** Run every manager that is due today (past run hour, not yet run). Used by the scheduler. */
export async function runDueManagers(cfg: Config): Promise<ManagerSummary[]> {
  const { hour } = tzParts(cfg.MANAGERS_TZ);
  if (hour < cfg.MANAGER_RUN_HOUR) return [];
  const out: ManagerSummary[] = [];
  for (const mgr of MANAGERS) {
    try { out.push(await runManager(cfg, mgr)); }
    catch (e) { console.error(`[mgr:${mgr.id}] error:`, e instanceof Error ? e.message : e); }
  }
  return out;
}
