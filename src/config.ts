import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  CLAUDE_CODE_OAUTH_TOKEN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RUNNER_SHARED_SECRET: z.string().min(16),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is set; unset it so the subscription token is used.");
  }
  return schema.parse(env);
}
