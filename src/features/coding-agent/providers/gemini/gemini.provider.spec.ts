import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigFileService } from "../_shared/config-file.service";
import { GEMINI_CONFIG, type GeminiSettings } from "./gemini.config";
import { GeminiProvider } from "./gemini.provider";

/** A ConfigFileService over an in-memory tree of JSON files. */
function inMemoryConfigFiles(initial: Record<string, unknown> = {}) {
  const files = new Map<string, unknown>(Object.entries(initial));
  const dirs = new Set<string>(["/home/.gemini"]);
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

const SETTINGS = "/home/.gemini/settings.json";
const foreignHook = { type: "command" as const, command: "echo foreign" };
const cognoHooksIn = (settings: GeminiSettings) =>
  Object.values(settings.hooks ?? {})
    .flat()
    .flatMap((group) => group.hooks)
    .filter((hook) => GEMINI_CONFIG.isCognoCommand(hook.command));

describe("GeminiProvider", () => {
  let files: Map<string, unknown>;
  let provider: GeminiProvider;

  beforeEach(() => {
    const memory = inMemoryConfigFiles({
      [SETTINGS]: { theme: "dark", hooks: { BeforeAgent: [{ hooks: [foreignHook] }] } },
    });
    files = memory.files;
    provider = new GeminiProvider(memory.service);
  });

  it("is missing its hook until installed, then current", async () => {
    expect(await provider.hookState()).toBe("missing");

    await provider.installHook("Bash");

    const settings = files.get(SETTINGS) as GeminiSettings;
    expect(settings["theme"]).toBe("dark");
    expect(cognoHooksIn(settings)).toHaveLength(GEMINI_CONFIG.hookEvents.length);
    expect(settings.hooks?.["BeforeAgent"]?.[0]?.hooks).toEqual([foreignHook]);
    expect(await provider.hookState()).toBe("current");
  });

  it("installs idempotently", async () => {
    await provider.installHook("Bash");
    await provider.installHook("Bash");

    expect(cognoHooksIn(files.get(SETTINGS) as GeminiSettings)).toHaveLength(
      GEMINI_CONFIG.hookEvents.length,
    );
  });

  it("reads a Cogno hook in an older form as outdated", async () => {
    await provider.installHook("Bash");
    const hook = (files.get(SETTINGS) as GeminiSettings).hooks?.["AfterAgent"]?.[0]?.hooks[0];
    if (hook) hook.command = hook.command.replace('"ready"', '"working"');

    expect(await provider.hookState()).toBe("outdated");
  });

  it("removes only the Cogno hooks", async () => {
    await provider.installHook("Bash");

    await provider.removeHook();

    const settings = files.get(SETTINGS) as GeminiSettings;
    expect(settings.hooks).toEqual({ BeforeAgent: [{ hooks: [foreignHook] }] });
    expect(await provider.hookState()).toBe("missing");
  });
});
