import type { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import { EMPTY } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigFileService } from "../_shared/config-file.service";
import { isCognoHookCommand } from "../_shared/hook-command";
import type { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { CURSOR_CONFIG, type CursorHooksFile } from "./cursor.config";
import { CursorProvider } from "./cursor.provider";

/** A ConfigFileService over an in-memory tree of JSON files. */
function inMemoryConfigFiles(initial: Record<string, unknown> = {}) {
  const files = new Map<string, unknown>(Object.entries(initial));
  const dirs = new Set<string>(["/home/.cursor"]);
  const service = {
    readJson: async <T>(path: string, fallback: T) => (files.get(path) as T) ?? fallback,
    writeJson: async (path: string, data: unknown) => {
      files.set(path, JSON.parse(JSON.stringify(data)));
    },
    exists: async (path: string) => files.has(path) || dirs.has(path),
    ensureDir: async (path: string) => {
      dirs.add(path);
    },
    configDir: async (subDir: string) => `/home/${subDir}`,
    configPath: async (subDir: string, fileName: string) => `/home/${subDir}/${fileName}`,
  } as unknown as ConfigFileService;
  return { service, files };
}

const scripts = {
  get: async () => ({
    bash: "/cogno/hooks/cogno-agent-hook.sh",
    powershell: "C:cognohookscogno-agent-hook.ps1",
  }),
} as unknown as HookScriptPathsService;
const ipc = { messages$: EMPTY } as unknown as TerminalIpcPort;

const HOOKS_FILE = "/home/.cursor/hooks.json";
const foreignHook = { command: "./hooks/audit.sh" };
const cognoHooksIn = (file: CursorHooksFile) =>
  Object.values(file.hooks ?? {})
    .flat()
    .filter((hook) => isCognoHookCommand(hook.command));

describe("CursorProvider", () => {
  let files: Map<string, unknown>;
  let provider: CursorProvider;

  beforeEach(() => {
    const memory = inMemoryConfigFiles({
      [HOOKS_FILE]: { version: 1, hooks: { stop: [foreignHook] } },
    });
    files = memory.files;
    provider = new CursorProvider(memory.service, scripts, ipc);
  });

  it("installs one Cogno hook per event next to the hooks that were there", async () => {
    expect(await provider.hookState()).toBe("missing");

    await provider.installHook("sh");

    const file = files.get(HOOKS_FILE) as CursorHooksFile;
    expect(file.version).toBe(1);
    expect(cognoHooksIn(file)).toHaveLength(CURSOR_CONFIG.hookEvents.length);
    expect(file.hooks?.["stop"]?.[0]).toEqual(foreignHook);
    expect(await provider.hookState()).toBe("current");
  });

  it("reads a Cogno hook in an older form as outdated", async () => {
    await provider.installHook("sh");
    const hook = (files.get(HOOKS_FILE) as CursorHooksFile).hooks?.["stop"]?.[1];
    if (hook) hook.command = hook.command.replace("cogno-agent-hook", "cogno-agent-hook-old");

    expect(await provider.hookState()).toBe("outdated");
  });

  it("drops a Cogno hook on an event this version no longer hooks", async () => {
    await provider.installHook("sh");
    const file = files.get(HOOKS_FILE) as CursorHooksFile;
    const staleCommand = file.hooks?.["stop"]?.[1]?.command ?? "";
    file.hooks = { ...file.hooks, subagentStop: [{ command: staleCommand }] };

    await provider.installHook("sh");

    expect((files.get(HOOKS_FILE) as CursorHooksFile).hooks?.["subagentStop"]).toBeUndefined();
  });

  it("creates a versioned hooks file when there is none", async () => {
    files.delete(HOOKS_FILE);

    await provider.installHook("sh");

    const file = files.get(HOOKS_FILE) as CursorHooksFile;
    expect(file.version).toBe(CURSOR_CONFIG.fileVersion);
    expect(cognoHooksIn(file)).toHaveLength(CURSOR_CONFIG.hookEvents.length);
  });

  it("installs idempotently: a second install does not double the hooks", async () => {
    await provider.installHook("sh");
    await provider.installHook("sh");

    expect(cognoHooksIn(files.get(HOOKS_FILE) as CursorHooksFile)).toHaveLength(
      CURSOR_CONFIG.hookEvents.length,
    );
  });

  it("does not touch Cursor's permission hooks", async () => {
    await provider.installHook("sh");

    const file = files.get(HOOKS_FILE) as CursorHooksFile;
    for (const event of [
      "preToolUse",
      "beforeShellExecution",
      "beforeMCPExecution",
      "subagentStart",
    ]) {
      expect(file.hooks?.[event]).toBeUndefined();
    }
  });

  it("removes only the Cogno hooks and drops events that are empty afterwards", async () => {
    await provider.installHook("sh");

    await provider.removeHook();

    const file = files.get(HOOKS_FILE) as CursorHooksFile;
    expect(file.version).toBe(1);
    expect(cognoHooksIn(file)).toEqual([]);
    expect(file.hooks).toEqual({ stop: [foreignHook] });
    expect(await provider.hookState()).toBe("missing");
  });

  it("leaves a hooks file without hooks alone on remove", async () => {
    files.set(HOOKS_FILE, { version: 1 });

    await provider.removeHook();

    expect(files.get(HOOKS_FILE)).toEqual({ version: 1 });
  });
});
