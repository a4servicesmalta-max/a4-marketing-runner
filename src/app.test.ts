import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AddressInfo } from "node:net";
import type { Config } from "./config.js";

const finish = vi.fn(async () => {});
const appendOutput = vi.fn(async () => {});
const create = vi.fn(async () => "run-123");

vi.mock("./runs.js", () => ({
  makeRunsRepo: () => ({ create, appendOutput, finish }),
}));

const runAgent = vi.fn(async () => ({ text: "ok" }));
vi.mock("./runAgent.js", () => ({
  runAgent: (...args: unknown[]) => (runAgent as (...a: unknown[]) => unknown)(...args),
}));

import { createApp } from "./app.js";

const SECRET = "super-secret-value-1234";
const cfg: Config = {
  PORT: 0,
  CLAUDE_CODE_OAUTH_TOKEN: "dummy-oauth-token",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "dummy-service-role-key",
  RUNNER_SHARED_SECRET: SECRET,
  IMAP_HOST: "imap.titan.email",
  IMAP_PORT: 993,
  INBOX_MAILBOX: "INBOX",
  INBOX_POLL_MINUTES: 5,
  INBOX_MAX_PER_CYCLE: 15,
  MANAGERS_ENABLED: true,
  MANAGERS_TZ: "Europe/Malta",
  MANAGER_RUN_HOUR: 7,
};

// Drive the Express app over an ephemeral port with fetch; close after each test.
async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = createApp(cfg);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function post(baseUrl: string, body: unknown, secret = SECRET) {
  return fetch(`${baseUrl}/run`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-runner-secret": secret },
    body: JSON.stringify(body),
  });
}

// A known employee id from the marketing team.
const KNOWN_EMPLOYEE = "seo-content-lead";

describe("POST /run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue("run-123");
    runAgent.mockResolvedValue({ text: "ok" });
  });

  it("(a) valid body + known employee + correct secret -> 202 with { runId } and runs the agent", async () => {
    await withServer(async (base) => {
      const res = await post(base, { employeeId: KNOWN_EMPLOYEE, task: "Do a thing" });
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ runId: "run-123" });
      // allow the fire-and-forget block to run
      await new Promise((r) => setTimeout(r, 20));
      expect(runAgent).toHaveBeenCalledOnce();
    });
  });

  it("(b) unknown employeeId -> 404", async () => {
    await withServer(async (base) => {
      const res = await post(base, { employeeId: "no-such-employee", task: "Do a thing" });
      expect(res.status).toBe(404);
      expect(runAgent).not.toHaveBeenCalled();
    });
  });

  it("(c) runAgent throws -> still 202 (fire-and-forget) and repo.finish is called with error", async () => {
    runAgent.mockRejectedValueOnce(new Error("boom"));
    await withServer(async (base) => {
      const res = await post(base, { employeeId: KNOWN_EMPLOYEE, task: "Do a thing" });
      expect(res.status).toBe(202);
      // allow the async block to run and hit the catch
      await new Promise((r) => setTimeout(r, 20));
      expect(finish).toHaveBeenCalledWith("run-123", "error", "boom");
    });
  });
});
