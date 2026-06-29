import express from "express";
import { z } from "zod";
import { requireSecret } from "./auth.js";
import { getEmployee } from "./employees.js";
import { makeRunsRepo } from "./runs.js";
import { runAgent } from "./runAgent.js";
import { pollInbox } from "./inbox/poll.js";
import { runManager, runDueManagers } from "./managers/run.js";
import { getManager, MANAGERS } from "./managers/playbooks.js";
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

  // Manual Inbox→Tasks poll (secret-locked) — same logic the scheduler runs.
  app.post("/inbox/poll", requireSecret(cfg.RUNNER_SHARED_SECRET), async (_req, res) => {
    try {
      const summary = await pollInbox(cfg);
      res.json(summary);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // Manual department-manager run (secret-locked). Body: { dept?, force? }.
  // No dept → run all due today; dept → run that one (force ignores the once-a-day guard).
  app.post("/managers/run", requireSecret(cfg.RUNNER_SHARED_SECRET), async (req, res) => {
    const dept = typeof req.body?.dept === "string" ? req.body.dept : undefined;
    const force = req.body?.force === true;
    try {
      if (dept) {
        const mgr = getManager(dept);
        if (!mgr) return res.status(404).json({ error: `unknown dept '${dept}' (use one of: ${MANAGERS.map((m) => m.id).join(", ")})` });
        return res.json(await runManager(cfg, mgr, { force }));
      }
      res.json(await runDueManagers(cfg));
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

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
          async (chunk) => { await repo.appendOutput(runId, chunk); },
        );
        await repo.finish(runId, "done");
      } catch (e) {
        // Guard the error-path status write: if finish() itself rejects, swallow it
        // so a failed status write can't escape as an unhandled rejection.
        try {
          await repo.finish(runId, "error", e instanceof Error ? e.message : String(e));
        } catch (finishErr) {
          console.error("failed to write error status for run", runId, finishErr);
        }
      }
    })();
  });

  return app;
}
