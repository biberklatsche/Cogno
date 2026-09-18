import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigFileService } from "../_shared/config-file.service";
import { CLAUDE_CODE_CONFIG, type ClaudeSettings } from "./claude-code.config";
import { ClaudeCodeProvider } from "./claude-code.provider";

/** A ConfigFileService over an in-memory tree of JSON files. */
function inMemoryConfigFiles(initial: Record<string, unknown> = {}) {
  const files = new Map<string, unknown>(Object.entries(initial));
  const dirs = new Set<string>(["/home/.claude"]);
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

const SETTINGS = "/home/.claude/settings.json";
const foreignHook = { type: "command" as const, command: "echo foreign" };
const cognoHooksIn = (settings: ClaudeSettings) =>
  Object.values(settings.hooks ?? {})
    .flat()
    .flatMap((group) => group.hooks)
    .filter((hook) => CLAUDE_CODE_CONFIG.isCognoCommand(hook.command));

describe("ClaudeCodeProvider", () => {
  let files: Map<string, unknown>;
  let provider: ClaudeCodeProvider;

  beforeEach(() => {
    const memory = inMemoryConfigFiles({
      [SETTINGS]: {
        theme: "dark",
        hooks: { UserPromptSubmit: [{ hooks: [foreignHook] }] },
      },
    });
    files = memory.files;
    provider = new ClaudeCodeProvider(memory.service);
  });

  it("installs one Cogno hook per event next to the hooks that were there", async () => {
    await provider.installHook("Bash");

    const settings = files.get(SETTINGS) as ClaudeSettings;
    expect(settings["theme"]).toBe("dark");
    expect(cognoHooksIn(settings)).toHaveLength(CLAUDE_CODE_CONFIG.hookEvents.length);
    expect(settings.hooks?.["UserPromptSubmit"]?.[0]?.hooks).toEqual([foreignHook]);
    expect(await provider.isHookInstalled()).toBe(true);
  });

  it("installs idempotently: a second install does not double the hooks", async () => {
    await provider.installHook("Bash");
    await provider.installHook("Bash");

    expect(cognoHooksIn(files.get(SETTINGS) as ClaudeSettings)).toHaveLength(
      CLAUDE_CODE_CONFIG.hookEvents.length,
    );
  });

  it("removes only the Cogno hooks and drops events that are empty afterwards", async () => {
    await provider.installHook("Bash");

    await provider.removeHook();

    const settings = files.get(SETTINGS) as ClaudeSettings;
    expect(settings["theme"]).toBe("dark");
    expect(cognoHooksIn(settings)).toEqual([]);
    expect(settings.hooks).toEqual({ UserPromptSubmit: [{ hooks: [foreignHook] }] });
    expect(await provider.isHookInstalled()).toBe(false);
  });

  it("leaves a settings file without hooks alone on remove", async () => {
    files.set(SETTINGS, { theme: "dark" });

    await provider.removeHook();

    expect(files.get(SETTINGS)).toEqual({ theme: "dark" });
  });
});
