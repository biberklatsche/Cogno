import { AgentStatus } from "@cogno/shared/domain";
import { CODING_AGENT_STATUS_ACTION } from "../_shared/hook-command.builder";

export type OpenCodeEventEntry = { readonly eventName: string; readonly status: AgentStatus };

/**
 * OpenCode has no shell hooks; it loads plugins from `~/.config/opencode/plugins/`
 * (a `plugin/` folder works too). Cogno's plugin is a v2 plugin (`default` with
 * `id` and `setup`, the shape OpenCode 2.x accepts) that sends the same status
 * POST the shell hooks send. OpenCode runs plugins in its background service,
 * so the process env is not the terminal's; the plugin therefore also reports
 * the session's directory, which is where the terminal's OpenCode was started.
 */
export const OPENCODE_CONFIG = {
  id: "opencode",
  name: "OpenCode",
  configSubDir: ".config/opencode",
  pluginsSubDir: "plugins",
  pluginFileName: "cogno-status.js",
  /** Events of `ctx.event.subscribe()`, verified against OpenCode 2.0.16. */
  events: [
    { eventName: "session.created", status: "ready" as AgentStatus },
    { eventName: "session.execution.started", status: "working" as AgentStatus },
    { eventName: "session.execution.succeeded", status: "ready" as AgentStatus },
    { eventName: "session.execution.interrupted", status: "ready" as AgentStatus },
    { eventName: "session.execution.failed", status: "error" as AgentStatus },
    { eventName: "permission.asked", status: "question" as AgentStatus },
    { eventName: "permission.replied", status: "working" as AgentStatus },
  ] as ReadonlyArray<OpenCodeEventEntry>,
} as const;

/** The plugin source Cogno writes. Regenerated on install; on-disk drift means "not installed". */
export function buildOpenCodePlugin(): string {
  const eventStatus = Object.fromEntries(
    OPENCODE_CONFIG.events.map(({ eventName, status }) => [eventName, status]),
  );
  return `// Cogno status plugin. Written by Cogno; edits are overwritten when the hook is reinstalled.
// Reports what OpenCode is doing to the Cogno terminal it runs in. Outside Cogno it does nothing.
const PORT = process.env.COGNO_PORT;
const TERMINAL_ID = process.env.COGNO_TERMINAL_ID;
const EVENT_STATUS = ${JSON.stringify(eventStatus)};

function report(status, hook, directory, payload) {
  if (!PORT) return;
  const seq = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    command: ${JSON.stringify(CODING_AGENT_STATUS_ACTION)},
    args: [status, ${JSON.stringify(OPENCODE_CONFIG.id)}, hook, seq],
    terminal_id: TERMINAL_ID,
    payload: { directory, ...payload },
  });
  // Fire and forget: the agent never waits for Cogno, and a missing Cogno is not an error.
  fetch("http://127.0.0.1:" + PORT + "/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {});
}

function toolInput(input) {
  if (!input || typeof input !== "object") return {};
  const path = typeof input.path === "string" ? input.path : input.filePath;
  return { ...input, ...(typeof path === "string" ? { file_path: path } : {}) };
}

export default {
  id: "cogno-status",
  setup: async (ctx) => {
    const directory = ctx.location?.directory;
    (async () => {
      for await (const event of ctx.event.subscribe()) {
        const status = EVENT_STATUS[event.type];
        if (status) report(status, event.type, event.location?.directory ?? directory, event.data);
      }
    })().catch(() => {});
    await ctx.tool.hook("execute.before", (input) => {
      report("working", "tool.execute.before", directory, {
        tool_name: input.tool,
        tool_input: toolInput(input.input),
      });
    });
  },
};
`;
}
