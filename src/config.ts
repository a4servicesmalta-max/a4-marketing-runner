import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  CLAUDE_CODE_OAUTH_TOKEN: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RUNNER_SHARED_SECRET: z.string().min(16),
  // Inbox→Tasks (optional; the poller only runs when IMAP_USER + IMAP_PASSWORD are set)
  IMAP_HOST: z.string().default("imap.titan.email"),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_USER: z.string().optional(),
  IMAP_PASSWORD: z.string().optional(),
  INBOX_MAILBOX: z.string().default("INBOX"),
  INBOX_POLL_MINUTES: z.coerce.number().default(5),
  INBOX_MAX_PER_CYCLE: z.coerce.number().default(15),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is set; unset it so the subscription token/login is used.");
  }
  const cfg = schema.parse(env);
  if (!cfg.CLAUDE_CODE_OAUTH_TOKEN) {
    console.warn(
      "[config] No CLAUDE_CODE_OAUTH_TOKEN — relying on this machine's Claude Code login (local dev only; Render must set the token)."
    );
  }
  return cfg;
}
