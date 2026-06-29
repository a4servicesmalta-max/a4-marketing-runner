import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailMsg } from "./imap.js";
import type { TaskVerdict } from "./classify.js";

/** Insert a task into the portal's `tasks` table (shows on the Tasks screen). */
export async function createInboxTask(supa: SupabaseClient, v: TaskVerdict, msg: EmailMsg): Promise<string> {
  const id = `task_inbox_${msg.uid}_${Date.now()}`;
  const description =
    `${v.description}\n\n— From inbox: ${msg.fromName || msg.from} <${msg.from}> · "${msg.subject}" (${msg.date.slice(0, 10)})`;
  const { error } = await supa.from("tasks").insert({
    id,
    title: v.title || msg.subject.slice(0, 80),
    description,
    team: "Ops",
    status: "To do",
    priority: v.priority,
    due_label: v.dueLabel,
    tag: "Inbox",
    done: false,
  });
  if (error) throw error;
  return id;
}
