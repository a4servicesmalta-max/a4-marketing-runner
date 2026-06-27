import { describe, it, expect, vi } from "vitest";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(async function* () {
    yield { type: "assistant", message: { content: [{ type: "text", text: "Hello " }] } };
    yield { type: "assistant", message: { content: [{ type: "text", text: "world" }] } };
    yield { type: "result", subtype: "success", result: "Hello world", total_cost_usd: 0.01 };
  }),
}));

import { runAgent } from "./runAgent.js";

describe("runAgent", () => {
  it("streams text chunks and resolves with the final result", async () => {
    const chunks: string[] = [];
    const result = await runAgent(
      { employeeId: "demand-gen", rolePrompt: "You are X.", skills: ["prospecting"], task: "Do a thing", projectDir: "/tmp/x" },
      (c) => chunks.push(c),
    );
    expect(chunks.join("")).toContain("Hello world");
    expect(result.text).toContain("Hello world");
  });
});
