import type { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import { EMPTY } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigFileService } from "../_shared/config-file.service";
import type { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { openCodePlugin } from "./opencode.config";
import { OpenCodeProvider } from "./opencode.provider";

/** A ConfigFileService over an in-memory tree of text files. */
function inMemoryConfigFiles(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial));
  const dirs = new Set<string>(["/home/.config/opencode", "/home/.config/opencode/plugins"]);
  const service = {
    readText: async (path: string) => files.get(path),
    writeText: async (path: string, content: string) => {
      files.set(path, content);
    },
    remove: async (path: string, options?: { recursive?: boolean }) => {
      files.delete(path);
      if (!options?.recursive) return;
      dirs.delete(path);
      for (const file of [...files.keys()]) if (file.startsWith(`${path}/`)) files.delete(file);
    },
    exists: async (path: string) => files.has(path) || dirs.has(path),
    ensureDir: async (path: string) => {
      dirs.add(path);
    },
    configDir: async (subDir: string) => `/home/${subDir}`,
    configPath: async (subDir: string, fileName: string) => `/home/${subDir}/${fileName}`,
    join: async (...parts: string[]) => parts.join("/"),
  } as unknown as ConfigFileService;
  return { service, files, dirs };
}

const ENDPOINT = "/home/.cogno/endpoint.json";
const scripts = { endpointPath: async () => ENDPOINT } as unknown as HookScriptPathsService;
const ipc = { messages$: EMPTY } as unknown as TerminalIpcPort;

const PLUGIN_DIR = "/home/.config/opencode/plugins/cogno";
const PLUGIN = `${PLUGIN_DIR}/index.js`;
const LEGACY = "/home/.config/opencode/plugins/cogno-status.js";
const FOREIGN = "/home/.config/opencode/plugins/mine/index.ts";

describe("OpenCodeProvider", () => {
  let files: Map<string, string>;
  let dirs: Set<string>;
  let provider: OpenCodeProvider;

  beforeEach(() => {
    const memory = inMemoryConfigFiles({ [FOREIGN]: "export default {}" });
    files = memory.files;
    dirs = memory.dirs;
    provider = new OpenCodeProvider(memory.service, scripts, ipc);
  });

  it("is installed when OpenCode's config directory exists", async () => {
    expect(await provider.isAgentInstalled()).toBe(true);
    dirs.delete("/home/.config/opencode");
    expect(await provider.isAgentInstalled()).toBe(false);
  });

  it("writes the plugin folder with the endpoint file baked in, and leaves other plugins alone", async () => {
    expect(await provider.hookState()).toBe("missing");

    await provider.installHook();

    expect(files.get(PLUGIN)).toBe(openCodePlugin(ENDPOINT));
    expect(files.get(PLUGIN)).toContain(JSON.stringify(ENDPOINT));
    expect(files.get(FOREIGN)).toBe("export default {}");
    expect(await provider.hookState()).toBe("current");
  });

  it("reads an edited plugin as outdated and an install writes it again", async () => {
    await provider.installHook();
    files.set(PLUGIN, `${files.get(PLUGIN)}\n// edited`);

    expect(await provider.hookState()).toBe("outdated");

    await provider.installHook();

    expect(files.get(PLUGIN)).toBe(openCodePlugin(ENDPOINT));
  });

  it("clears the single-file plugin an earlier Cogno wrote, on install and on remove", async () => {
    files.set(LEGACY, "// old");
    expect(await provider.hookState()).toBe("outdated");

    await provider.installHook();

    expect(files.has(LEGACY)).toBe(false);
    expect(await provider.hookState()).toBe("current");

    files.set(LEGACY, "// old again");
    await provider.removeHook();

    expect(files.has(LEGACY)).toBe(false);
  });

  it("removes the whole plugin folder and nothing else", async () => {
    await provider.installHook();

    await provider.removeHook();

    expect(files.has(PLUGIN)).toBe(false);
    expect(dirs.has(PLUGIN_DIR)).toBe(false);
    expect(files.get(FOREIGN)).toBe("export default {}");
    expect(await provider.hookState()).toBe("missing");
  });
});

describe("openCodePlugin", () => {
  it("is a v2 plugin that posts Cogno's hook message without naming a terminal", () => {
    const source = openCodePlugin("C:\\Users\\me\\.cogno\\endpoint.json");

    expect(source).toContain('id: "cogno"');
    expect(source).toContain("async setup(ctx)");
    expect(source).toContain('const ENDPOINT = "C:\\\\Users\\\\me\\\\.cogno\\\\endpoint.json"');
    expect(source).toContain("command: COMMAND");
    expect(source).toContain('"X-Cogno-Token": target.token');
    expect(source).not.toContain("terminal_id");
    expect(source).toContain("ctx.event.subscribe({ types: EVENTS");
    expect(source).toContain('ctx.session.hook("prompt"');
    expect(source).toContain('ctx.tool.hook("execute.before"');
  });
});
