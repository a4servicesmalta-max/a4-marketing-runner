import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { Config } from "../config.js";

export interface EmailMsg {
  uid: number;
  from: string;
  fromName: string;
  subject: string;
  text: string;
  date: string;
}

export interface FetchResult {
  maxUid: number;
  messages: EmailMsg[];
}

function client(cfg: Config) {
  return new ImapFlow({
    host: cfg.IMAP_HOST,
    port: cfg.IMAP_PORT,
    secure: true,
    auth: { user: cfg.IMAP_USER!, pass: cfg.IMAP_PASSWORD! },
    logger: false,
  });
}

/**
 * Fetch messages with UID strictly greater than `sinceUid`, newest-capped to `max`.
 * Opens the mailbox READ-ONLY so the \Seen flag is never touched.
 * On first run (sinceUid <= 0) returns no messages — only the current maxUid — so
 * we start from "now" instead of replaying the whole mailbox history.
 */
export async function fetchNewMessages(cfg: Config, sinceUid: number, max: number): Promise<FetchResult> {
  const c = client(cfg);
  await c.connect();
  try {
    const mb = await c.mailboxOpen(cfg.INBOX_MAILBOX, { readOnly: true });
    const maxUid = Math.max(0, (mb.uidNext ?? 1) - 1);
    if (sinceUid <= 0 || maxUid <= sinceUid) return { maxUid, messages: [] };

    const out: EmailMsg[] = [];
    for await (const m of c.fetch(`${sinceUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
      if (!m.uid || m.uid <= sinceUid || !m.source) continue; // guard the IMAP `*` quirk
      const parsed = await simpleParser(m.source);
      const fromObj = parsed.from?.value?.[0];
      out.push({
        uid: m.uid,
        from: fromObj?.address ?? "",
        fromName: fromObj?.name ?? "",
        subject: parsed.subject ?? "(no subject)",
        text: (parsed.text ?? "").slice(0, 6000),
        date: (parsed.date ?? new Date()).toISOString(),
      });
    }
    out.sort((a, b) => a.uid - b.uid);
    // cap to the most recent `max` to bound cost on a backlog
    const messages = out.slice(-max);
    return { maxUid, messages };
  } finally {
    try { await c.logout(); } catch { /* ignore */ }
  }
}
