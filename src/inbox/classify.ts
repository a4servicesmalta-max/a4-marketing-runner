import { query } from "@anthropic-ai/claude-agent-sdk";
import type { EmailMsg } from "./imap.js";

export interface TaskVerdict {
  isTask: boolean;
  title: string;
  description: string;
  priority: "High" | "Med" | "Low";
  dueLabel: string;
}

/** Cheap heuristic so we don't spend a model call on obvious automated/bulk mail. */
export function looksAutomated(msg: EmailMsg): boolean {
  const a = msg.from.toLowerCase();
  if (/(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|newsletter@|news@|notifications?@|noreply@)/.test(a)) return true;
  const s = msg.subject.toLowerCase();
  if (/(unsubscribe|newsletter|digest|out of office|automatic reply)/.test(s)) return true;
  return false;
}

function parseJson(text: string): TaskVerdict | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    return {
      isTask: !!o.isTask,
      title: String(o.title ?? "").slice(0, 80),
      description: String(o.description ?? "").slice(0, 1500),
      priority: ["High", "Med", "Low"].includes(o.priority) ? o.priority : "Med",
      dueLabel: String(o.dueLabel ?? "").slice(0, 40),
    };
  } catch { return null; }
}

const SYS = `You are an operations assistant for A4 Services, an audit/accounting firm.
Given one inbound email, decide whether it requires the TEAM to take a concrete action (a task to do).
Treat as a task: client requests, deadlines, things to send/review/sign/pay/reply-with-work, follow-ups someone is waiting on.
NOT a task: newsletters, marketing, receipts/confirmations needing no action, FYI-only notices, automated noise.
Respond with ONLY a JSON object, no prose:
{"isTask": true|false, "title": "<imperative, <=80 chars>", "description": "<what's needed + sender + any deadline>", "priority": "High|Med|Low", "dueLabel": "<e.g. 'by Fri' or ''>"}`;

export async function classifyEmail(msg: EmailMsg): Promise<TaskVerdict> {
  const prompt = `${SYS}\n\n---\nFROM: ${msg.fromName} <${msg.from}>\nDATE: ${msg.date}\nSUBJECT: ${msg.subject}\n\nBODY:\n${msg.text}`;
  let text = "";
  for await (const m of query({ prompt, options: { allowedTools: [], maxTurns: 1 } })) {
    if (m.type === "result" && m.subtype === "success" && typeof m.result === "string") text = m.result;
  }
  return parseJson(text) ?? { isTask: false, title: "", description: "", priority: "Med", dueLabel: "" };
}
