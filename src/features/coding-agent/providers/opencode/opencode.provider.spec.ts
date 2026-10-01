import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigFileService } from "../_shared/config-file.service";
import { buildOpenCodePlugin, OPENCODE_CONFIG } from "./opencode.config";
import { OpenCodeProvider } from "./opencode.provider";

/** A ConfigFileService over an in-memory tree of text files. */
function inMemoryConfigFiles(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial));
  const dirs = new Set<string>(["/home/.config/opencode"]);
  const service = {
    readText: async (path: string) => files.get(path),
    writeText: async (path: string, content: string) => {
      files.set(path, content);
    },
    remove: async (path: string) => {
      files.delete(path);
    },
    exists: async (path: string) => files.has(path) || dirs.has(path),
    ensureDir: async (path: string) => {
      dirs.add(path);
    },
    homeDir: async () => "/home",
    joinPath: async (...parts: string[]) => parts.join("/"),
  } as unknown as ConfigFileService;
  return { service, files, dirs };
}

const PLUGIN = "/home/.config/opencode/plugins/cogno-status.js";
const FOREIGN = "/home/.config/opencode/plugins/mine.ts";

describe("OpenCodeProvider", () => {
  let files: Map<string, string>;
  let dirs: Set<string>;
  let provider: OpenCodeProvider;

  beforeEach(() => {
    const memory = inMemoryConfigFiles({ [FOREIGN]: "export const Mine = async () => ({});" });
    files = memory.files;
    dirs = memory.dirs;
    provider = new OpenCodeProvider(memory.service);
  });

  it("is installed when OpenCode's config directory exists", async () => {
    expect(await provider.isAgentInstalled()).toBe(true);
    dirs.delete("/home/.config/opencode");
    expect(await provider.isAgentInstalled()).toBe(false);
  });

  it("writes the plugin file and leaves other plugins alone", async () => {
    await provider.installHook();

    expect(files.get(PLUGIN)).toBe(buildOpenCodePlugin());
    expect(files.get(FOREIGN)).toBe("export const Mine = async () => ({});");
    expect(dirs.has("/home/.config/opencode/plugins")).toBe(true);
    expect(await provider.isHookInstalled()).toBe(true);
  });

  it("treats an edited plugin file as not installed", async () => {
    await provider.installHook();
    files.set(PLUGIN, `${files.get(PLUGIN)}\n// edited`);

    expect(await provider.isHookInstalled()).toBe(false);

    await provider.installHook();
    expect(await provider.isHookInstalled()).toBe(true);
  });

  it("removes only its own file", async () => {
    await provider.installHook();

    await provider.removeHook();

    expect(files.has(PLUGIN)).toBe(false);
    expect(files.has(FOREIGN)).toBe(true);
    expect(await provider.isHookInstalled()).toBe(false);
  });

  it("removes nothing when the plugin was never installed", async () => {
    await expect(provider.removeHook()).resolves.toBeUndefined();
    expect(files.has(FOREIGN)).toBe(true);
  });
});

describe("buildOpenCodePlugin", () => {
  it("is valid JavaScript with a default plugin definition (id and setup)", async () => {
    const source = buildOpenCodePlugin();
    const module = await import(`data:text/javascript;base64,${btoa(source)}`);

    expect(module.default.id).toBe("cogno-status");
    expect(typeof module.default.setup).toBe("function");
  });

  it("maps every configured event and the provider id into the source", () => {
    const source = buildOpenCodePlugin();
    for (const { eventName, status } of OPENCODE_CONFIG.events) {
      expect(source).toContain(`"${eventName}":"${status}"`);
    }
    expect(source).toContain(`"${OPENCODE_CONFIG.id}"`);
    expect(source).toContain("COGNO_TERMINAL_ID");
  });
});
