import { AgentStatus } from "../../agent-status";
import { CODING_AGENT_HOOK_COMMAND } from "../_shared/hook-command";

export type OpenCodeEventEntry = { readonly eventName: string; readonly status: AgentStatus };

/** The plugin's own names for what it gets from OpenCode's hooks rather than its events. */
export const OPENCODE_PROMPT_EVENT = "session.prompt";
export const OPENCODE_TOOL_EVENT = "tool.execute.before";

/** Events of `ctx.event.subscribe()`; `session.idle` is declared but never sent by OpenCode 2. */
const SUBSCRIBED_EVENTS: ReadonlyArray<OpenCodeEventEntry> = [
  { eventName: "session.created", status: "ready" },
  { eventName: "session.execution.started", status: "working" },
  { eventName: "session.execution.succeeded", status: "ready" },
  { eventName: "session.execution.interrupted", status: "ready" },
  { eventName: "session.execution.failed", status: "error" },
  { eventName: "permission.asked", status: "question" },
  { eventName: "permission.replied", status: "working" },
];

/**
 * OpenCode has no shell hooks: it loads plugins, each a folder with an
 * `index.js`, from `~/.config/opencode/plugins/`, and runs them in its
 * background service (ARCHITECTURE.md 3.2). Cogno's plugin is a folder of
 * Cogno's own: installing writes it, removing deletes it.
 */
export const OPENCODE_CONFIG = {
  id: "opencode",
  name: "OpenCode",
  configSubDir: ".config/opencode",
  pluginsSubDir: "plugins",
  pluginDirName: "cogno",
  pluginFileName: "index.js",
  /** The single-file plugin an earlier Cogno wrote; OpenCode 2 ignores it, Cogno clears it. */
  legacyPluginFileName: "cogno-status.js",
  processNames: ["opencode", "opencode.exe"],
  hookEvents: [
    ...SUBSCRIBED_EVENTS,
    { eventName: OPENCODE_PROMPT_EVENT, status: "working" },
    { eventName: OPENCODE_TOOL_EVENT, status: "working" },
  ] as ReadonlyArray<OpenCodeEventEntry>,
} as const;

/**
 * The plugin source. It runs in OpenCode's background service, which has no
 * terminal environment, so it finds Cogno through the endpoint file (the
 * terminal's own environment, if any, is only a fallback and never names a
 * terminal: the service's environment is the first starter's, not this
 * session's). Every message carries the session, its parent when it is a
 * subagent's, and its folder, so Cogno can place it (ARCHITECTURE.md 3.2).
 * Nothing in here ever fails OpenCode: every error is swallowed.
 */
export function openCodePlugin(endpointPath: string): string {
  const subscribed = SUBSCRIBED_EVENTS.map((entry) => entry.eventName);
  return `// Cogno coding-agent plugin for OpenCode. Written by Cogno; edits are overwritten.
import { readFileSync } from "node:fs";

const PROVIDER = ${JSON.stringify(OPENCODE_CONFIG.id)};
const COMMAND = ${JSON.stringify(CODING_AGENT_HOOK_COMMAND)};
const ENDPOINT = ${JSON.stringify(endpointPath)};
const EVENTS = ${JSON.stringify(subscribed)};

function endpoint() {
  try {
    const file = JSON.parse(readFileSync(ENDPOINT, "utf8"));
    if (file.port && file.token) return file;
  } catch {}
  const { COGNO_PORT, COGNO_TOKEN } = process.env;
  return COGNO_PORT && COGNO_TOKEN ? { port: COGNO_PORT, token: COGNO_TOKEN } : undefined;
}

function post(hookEvent, payload) {
  const target = endpoint();
  if (!target) return;
  const body = JSON.stringify({
    command: COMMAND,
    args: [PROVIDER, String(Date.now()), hookEvent],
    payload,
  });
  fetch("http://127.0.0.1:" + target.port + "/action", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Cogno-Token": target.token },
    body,
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

function promptText(prompt) {
  if (typeof prompt === "string") return prompt;
  const parts = Array.isArray(prompt) ? prompt : prompt && Array.isArray(prompt.parts) ? prompt.parts : [];
  return parts
    .map((part) => (typeof part === "string" ? part : part && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\\n");
}

function toolInput(input) {
  if (!input || typeof input !== "object") return {};
  const path = typeof input.filePath === "string" ? input.filePath : input.path;
  return { ...input, ...(typeof path === "string" ? { file_path: path } : {}) };
}

export default {
  id: ${JSON.stringify(OPENCODE_CONFIG.pluginDirName)},
  async setup(ctx) {
    const sessions = new Map();
    const remember = (sessionID, parentID, directory) => {
      const facts = { session_id: sessionID, parent_id: parentID, directory };
      sessions.set(sessionID, facts);
      return facts;
    };
    const factsOf = async (sessionID) => {
      const known = sessions.get(sessionID);
      if (known) return known;
      try {
        const result = await ctx.session.get({ sessionID });
        const info = result && result.data ? result.data : result;
        return remember(sessionID, info?.parentID, info?.location?.directory);
      } catch {
        return remember(sessionID, undefined, undefined);
      }
    };

    const controller = new AbortController();
    (async () => {
      for await (const event of ctx.event.subscribe({ types: EVENTS, signal: controller.signal })) {
        try {
          const data = event.data || {};
          if (!data.sessionID) continue;
          const location = (data.location && data.location.directory) || (event.location && event.location.directory);
          const facts =
            event.type === "session.created"
              ? remember(data.sessionID, data.parentID, location)
              : await factsOf(data.sessionID);
          post(event.type, { ...data, ...facts, directory: facts.directory || location });
        } catch {}
      }
    })().catch(() => {});

    await ctx.session.hook("prompt", async (event) => {
      try {
        const facts = await factsOf(event.sessionID);
        post(${JSON.stringify(OPENCODE_PROMPT_EVENT)}, { ...facts, prompt: promptText(event.prompt) });
      } catch {}
    });
    await ctx.tool.hook("execute.before", async (event) => {
      try {
        const facts = await factsOf(event.sessionID);
        post(${JSON.stringify(OPENCODE_TOOL_EVENT)}, { ...facts, tool_name: event.tool, tool_input: toolInput(event.input) });
      } catch {}
    });

    return () => controller.abort();
  },
};
`;
}
