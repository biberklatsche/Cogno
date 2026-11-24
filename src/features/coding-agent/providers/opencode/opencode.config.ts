import { AgentStatus } from "../../agent-status";

export type OpenCodeEventEntry = { readonly eventName: string; readonly status: AgentStatus };

/**
 * What the plugin reports. Most are events of `ctx.event.subscribe()`
 * (`session.idle` is declared but never sent by OpenCode 2); `prompt` and
 * `tool` are the plugin's own names for what it gets from OpenCode's hooks.
 */
export const OPENCODE_EVENT = {
  created: "session.created",
  started: "session.execution.started",
  succeeded: "session.execution.succeeded",
  interrupted: "session.execution.interrupted",
  failed: "session.execution.failed",
  permissionAsked: "permission.asked",
  permissionReplied: "permission.replied",
  prompt: "session.prompt",
  tool: "tool.execute.before",
} as const;

const SUBSCRIBED_EVENTS: ReadonlyArray<OpenCodeEventEntry> = [
  { eventName: OPENCODE_EVENT.created, status: "ready" },
  { eventName: OPENCODE_EVENT.started, status: "working" },
  { eventName: OPENCODE_EVENT.succeeded, status: "ready" },
  { eventName: OPENCODE_EVENT.interrupted, status: "ready" },
  { eventName: OPENCODE_EVENT.failed, status: "error" },
  { eventName: OPENCODE_EVENT.permissionAsked, status: "question" },
  { eventName: OPENCODE_EVENT.permissionReplied, status: "working" },
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
    { eventName: OPENCODE_EVENT.prompt, status: "working" },
    { eventName: OPENCODE_EVENT.tool, status: "working" },
  ] as ReadonlyArray<OpenCodeEventEntry>,
} as const;

/**
 * The plugin source. It runs in OpenCode's background service, which has no
 * terminal environment of its own: the service's environment is the first
 * starter's, not this session's. So it hands every event to Cogno's starter
 * (`cogno hook`) without the terminal and host that environment names; the
 * host of this machine passes an event that names no terminal on to every
 * Cogno, and the one whose terminal runs the session binds it there. Every
 * message carries the session, its parent when it is a subagent's, and its
 * folder, so Cogno can place it (ARCHITECTURE.md 3.2). Nothing in here ever
 * fails OpenCode: every error is swallowed.
 */
export function openCodePlugin(starterPath: string): string {
  const subscribed = SUBSCRIBED_EVENTS.map((entry) => entry.eventName);
  return `// Cogno coding-agent plugin for OpenCode. Written by Cogno; edits are overwritten.
import { spawn } from "node:child_process";

const PROVIDER = ${JSON.stringify(OPENCODE_CONFIG.id)};
const STARTER = ${JSON.stringify(starterPath)};
const EVENTS = ${JSON.stringify(subscribed)};

// How long one hook may hold up the next: \`cogno hook\` gives up long before.
const HOOK_PATIENCE_MS = 5000;
let sending = Promise.resolve();

// One hook after the other: each process ends once the host has its hook, so
// a later one, however quickly it starts, cannot overtake it.
function post(hookEvent, payload) {
  sending = sending.then(() => send(hookEvent, payload));
}

function send(hookEvent, payload) {
  return new Promise((done) => {
    try {
      const windows = process.platform === "win32";
      const env = { ...process.env, COGNO_TERMINAL_ID: "", COGNO_HOST: "" };
      // A .cmd starts only through cmd.exe; quoted, its path may hold spaces.
      const child = spawn(windows ? '"' + STARTER + '"' : STARTER, ["hook", PROVIDER, hookEvent], {
        env,
        shell: windows,
        stdio: ["pipe", "ignore", "ignore"],
        windowsHide: true,
      });
      child.on("error", done);
      child.on("exit", done);
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(payload));
      child.unref();
      setTimeout(done, HOOK_PATIENCE_MS).unref();
    } catch {
      done();
    }
  });
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
            event.type === ${JSON.stringify(OPENCODE_EVENT.created)}
              ? remember(data.sessionID, data.parentID, location)
              : await factsOf(data.sessionID);
          post(event.type, { ...data, ...facts, directory: facts.directory || location });
        } catch {}
      }
    })().catch(() => {});

    await ctx.session.hook("prompt", async (event) => {
      try {
        const facts = await factsOf(event.sessionID);
        post(${JSON.stringify(OPENCODE_EVENT.prompt)}, { ...facts, prompt: promptText(event.prompt) });
      } catch {}
    });
    await ctx.tool.hook("execute.before", async (event) => {
      try {
        const facts = await factsOf(event.sessionID);
        post(${JSON.stringify(OPENCODE_EVENT.tool)}, { ...facts, tool_name: event.tool, tool_input: toolInput(event.input) });
      } catch {}
    });

    return () => controller.abort();
  },
};
`;
}
