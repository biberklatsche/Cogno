import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigFileService } from "../_shared/config-file.service";
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
    homeDir: async () => "/home",
    joinPath: async (...parts: string[]) => parts.join("/"),
  } as unknown as ConfigFileService;
  return { service, files };
}

const HOOKS_FILE = "/home/.cursor/hooks.json";
const foreignHook = { command: "./hooks/audit.sh" };
const cognoHooksIn = (file: CursorHooksFile) =>
  Object.values(file.hooks ?? {})
    .flat()
    .filter((hook) => CURSOR_CONFIG.isCognoCommand(hook.command));

describe("CursorProvider", () => {
  let files: Map<string, unknown>;
  let provider: CursorProvider;

  beforeEach(() => {
    const memory = inMemoryConfigFiles({
      [HOOKS_FILE]: { version: 1, hooks: { stop: [foreignHook] } },
    });
    files = memory.files;
    provider = new CursorProvider(memory.service);
  });

  it("installs one Cogno hook per event next to the hooks that were there", async () => {
    await provider.installHook("Bash");

    const file = files.get(HOOKS_FILE) as CursorHooksFile;
    expect(file.version).toBe(1);
    expect(cognoHooksIn(file)).toHaveLength(CURSOR_CONFIG.hookEvents.length);
    expect(file.hooks?.["stop"]?.[0]).toEqual(foreignHook);
    expect(await provider.isHookInstalled()).toBe(true);
  });

  it("creates a versioned hooks file when there is none", async () => {
    files.delete(HOOKS_FILE);

    await provider.installHook("Bash");

    const file = files.get(HOOKS_FILE) as CursorHooksFile;
    expect(file.version).toBe(CURSOR_CONFIG.fileVersion);
    expect(cognoHooksIn(file)).toHaveLength(CURSOR_CONFIG.hookEvents.length);
  });

  it("installs idempotently: a second install does not double the hooks", async () => {
    await provider.installHook("Bash");
    await provider.installHook("Bash");

    expect(cognoHooksIn(files.get(HOOKS_FILE) as CursorHooksFile)).toHaveLength(
      CURSOR_CONFIG.hookEvents.length,
    );
  });

  it("does not touch Cursor's permission hooks", async () => {
    await provider.installHook("Bash");

    const file = files.get(HOOKS_FILE) as CursorHooksFile;
    for (const event of ["preToolUse", "beforeShellExecution", "beforeMCPExecution"]) {
      expect(file.hooks?.[event]).toBeUndefined();
    }
  });

  it("removes only the Cogno hooks and drops events that are empty afterwards", async () => {
    await provider.installHook("Bash");

    await provider.removeHook();

    const file = files.get(HOOKS_FILE) as CursorHooksFile;
    expect(file.version).toBe(1);
    expect(cognoHooksIn(file)).toEqual([]);
    expect(file.hooks).toEqual({ stop: [foreignHook] });
    expect(await provider.isHookInstalled()).toBe(false);
  });

  it("leaves a hooks file without hooks alone on remove", async () => {
    files.set(HOOKS_FILE, { version: 1 });

    await provider.removeHook();

    expect(files.get(HOOKS_FILE)).toEqual({ version: 1 });
  });
});
