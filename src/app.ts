import express from "express";
import { z } from "zod";
import { requireSecret } from "./auth.js";
import { getEmployee } from "./employees.js";
import { makeRunsRepo } from "./runs.js";
import { runAgent } from "./runAgent.js";
import type { Config } from "./config.js";

const RunBody = z.object({
  employeeId: z.string(),
  task: z.string().min(1).max(8000),
  createdBy: z.string().optional(),
});

export function createApp(cfg: Config) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  const repo = makeRunsRepo(cfg);
  const projectDir = process.cwd(); // runner/ holds vendored .claude

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/run", requireSecret(cfg.RUNNER_SHARED_SECRET), async (req, res) => {
    const parsed = RunBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const emp = getEmployee(parsed.data.employeeId);
    if (!emp) return res.status(404).json({ error: "unknown employee" });

    const runId = await repo.create(emp.id, parsed.data.task, parsed.data.createdBy);
    res.status(202).json({ runId }); // returns immediately; output streams to Supabase

    // fire-and-forget; portal subscribes via Supabase Realtime
    void (async () => {
      try {
        await runAgent(
          { employeeId: emp.id, rolePrompt: emp.rolePrompt, skills: emp.skills, task: parsed.data.task, projectDir },
          (chunk) => { void repo.appendOutput(runId, chunk); },
        );
        await repo.finish(runId, "done");
      } catch (e) {
        await repo.finish(runId, "error", e instanceof Error ? e.message : String(e));
      }
    })();
  });

  return app;
}
