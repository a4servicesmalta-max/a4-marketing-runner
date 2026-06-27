import { query } from "@anthropic-ai/claude-agent-sdk";

type QueryOptions = NonNullable<Parameters<typeof query>[0]["options"]>;
type McpServers = NonNullable<QueryOptions["mcpServers"]>;

export interface RunAgentInput {
  employeeId: string;
  rolePrompt: string;
  skills: string[];
  task: string;
  projectDir: string;          // dir containing vendored .claude/skills + .claude/agents
  mcpServers?: Record<string, unknown>;
  extraAllowedTools?: string[]; // e.g. ["mcp__higgsfield__*"]
}

export interface RunAgentResult { text: string; costUsd?: number; }

export async function runAgent(
  input: RunAgentInput,
  onChunk: (chunk: string) => void | Promise<void>,
): Promise<RunAgentResult> {
  const allowedTools = ["Skill", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", ...(input.extraAllowedTools ?? [])];
  const system =
    `${input.rolePrompt}\n\nYou may ONLY use these marketing skills via the Skill tool: ${input.skills.join(", ")}.`;

  let finalText = "", cost: number | undefined;
  for await (const msg of query({
    prompt: `${system}\n\n---\nTASK:\n${input.task}`,
    options: {
      cwd: input.projectDir,
      settingSources: ["project"],   // loads vendored .claude/skills + .claude/agents
      allowedTools,
      ...(input.mcpServers ? { mcpServers: input.mcpServers as McpServers } : {}),
    },
  })) {
    if (msg.type === "assistant") {
      for (const part of msg.message.content) {
        if (part.type === "text" && part.text) { finalText += part.text; await onChunk(part.text); }
      }
    } else if (msg.type === "result" && msg.subtype === "success") {
      if (typeof msg.result === "string" && msg.result) finalText = msg.result;
      cost = msg.total_cost_usd;
    }
  }
  return { text: finalText, costUsd: cost };
}
