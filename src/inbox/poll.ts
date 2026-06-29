import "../ws-polyfill.js";
import { createClient } from "@supabase/supabase-js";
import type { Config } from "../config.js";
import { fetchNewMessages } from "./imap.js";
import { looksAutomated, classifyEmail } from "./classify.js";
import { getLastUid, setLastUid } from "./state.js";
import { createInboxTask } from "./tasks.js";

export interface PollSummary {
  initialized?: boolean;
  atUid?: number;
  checked: number;
  tasksCreated: number;
  skippedAutomated: number;
  maxUid: number;
}

export async function pollInbox(cfg: Config): Promise<PollSummary> {
  if (!cfg.IMAP_USER || !cfg.IMAP_PASSWORD) throw new Error("IMAP not configured");
  const supa = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const mailbox = cfg.INBOX_MAILBOX;

  const last = await getLastUid(supa, mailbox);
  if (last === null) {
    // First run: anchor to the current head so we never replay history.
    const { maxUid } = await fetchNewMessages(cfg, 0, cfg.INBOX_MAX_PER_CYCLE);
    await setLastUid(supa, mailbox, maxUid);
    console.log(`[inbox] initialized ${mailbox} at uid ${maxUid} (history skipped)`);
    return { initialized: true, atUid: maxUid, checked: 0, tasksCreated: 0, skippedAutomated: 0, maxUid };
  }

  const { maxUid, messages } = await fetchNewMessages(cfg, last, cfg.INBOX_MAX_PER_CYCLE);
  if (maxUid - last > cfg.INBOX_MAX_PER_CYCLE) {
    console.warn(`[inbox] ${maxUid - last} new since uid ${last}; processing newest ${cfg.INBOX_MAX_PER_CYCLE}, advancing past the rest.`);
  }

  let tasksCreated = 0, skippedAutomated = 0, checked = 0;
  for (const msg of messages) {
    checked++;
    if (looksAutomated(msg)) { skippedAutomated++; continue; }
    try {
      const v = await classifyEmail(msg);
      if (v.isTask && v.title) {
        const id = await createInboxTask(supa, v, msg);
        tasksCreated++;
        console.log(`[inbox] task created ${id}: ${v.title}`);
      }
    } catch (e) {
      console.error(`[inbox] classify/create failed for uid ${msg.uid}:`, e instanceof Error ? e.message : e);
    }
  }

  if (maxUid > last) await setLastUid(supa, mailbox, maxUid);
  console.log(`[inbox] cycle: checked ${checked}, tasks ${tasksCreated}, skipped ${skippedAutomated}, head uid ${maxUid}`);
  return { checked, tasksCreated, skippedAutomated, maxUid };
}

/** Start the recurring poll loop. No-op if IMAP isn't configured. */
export function startInboxPoller(cfg: Config): void {
  if (!cfg.IMAP_USER || !cfg.IMAP_PASSWORD) {
    console.log("[inbox] poller disabled (no IMAP_USER/IMAP_PASSWORD)");
    return;
  }
  const everyMs = Math.max(1, cfg.INBOX_POLL_MINUTES) * 60_000;
  const tick = () => { pollInbox(cfg).catch((e) => console.error("[inbox] poll error:", e instanceof Error ? e.message : e)); };
  console.log(`[inbox] poller on for ${cfg.IMAP_USER} every ${cfg.INBOX_POLL_MINUTES}m`);
  setTimeout(tick, 8_000);          // first run shortly after boot
  setInterval(tick, everyMs);
}
