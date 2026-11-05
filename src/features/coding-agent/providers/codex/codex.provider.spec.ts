import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import type { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import { EMPTY } from "rxjs";
import { parse as parseToml } from "smol-toml";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigFileService } from "../_shared/config-file.service";
import { isCognoHookCommand } from "../_shared/hook-command";
import type { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { CODEX_CONFIG, type CodexHooksFile } from "./codex.config";
import { CodexProvider } from "./codex.provider";

/** A ConfigFileService over an in-memory tree of text files. */
function inMemoryConfigFiles(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial));
  const dirs = new Set<string>(["/home/.codex"]);
  const service = {
    readText: async (path: string) => files.get(path),
    writeText: async (path: string, content: string) => {
      files.set(path, content);
    },
    readJson: async <T>(path: string, fallback: T) => {
      const raw = files.get(path);
      return raw === undefined ? fallback : (JSON.parse(raw) as T);
    },
    writeJson: async (path: string, data: unknown) => {
      files.set(path, JSON.stringify(data, null, 2));
    },
    readToml: async <T>(path: string, fallback: T) => {
      const raw = files.get(path);
      return raw === undefined ? fallback : (parseToml(raw) as T);
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

const HOOKS = "/home/.codex/hooks.json";
const CONFIG = "/home/.codex/config.toml";
const USER_CONFIG = '# mine\nmodel = "gpt-5"\n\n[windows]\nsandbox = "elevated"\n';
const foreignHook = { type: "command" as const, command: "gk ai hook run" };
const staleCognoHook = {
  type: "command" as const,
  command: 'sh "/old/.cogno/coding-agents/cogno-agent-hook.sh" codex Stop',
};

const hooksFile = (files: Map<string, string>) =>
  JSON.parse(files.get(HOOKS) ?? "{}") as CodexHooksFile;
const cognoHooksIn = (file: CodexHooksFile) =>
  Object.values(file.hooks ?? {})
    .flat()
    .flatMap((group) => group.hooks)
    .filter((hook) => isCognoHookCommand(hook.command));

describe("CodexProvider", () => {
  let files: Map<string, string>;
  let dispatch: ReturnType<typeof vi.fn>;
  let provider: CodexProvider;

  beforeEach(() => {
    const memory = inMemoryConfigFiles({
      [HOOKS]: JSON.stringify({ hooks: { Stop: [{ hooks: [foreignHook], matcher: "" }] } }),
      [CONFIG]: USER_CONFIG,
    });
    files = memory.files;
    dispatch = vi.fn();
    const notifications = { dispatch } as unknown as NotificationCenterPort;
    provider = new CodexProvider(memory.service, scripts, notifications, ipc);
  });

  it("installs one hook per event next to the others, switches hooks on by the line and asks for trust", async () => {
    await provider.installHook();

    const file = hooksFile(files);
    expect(cognoHooksIn(file)).toHaveLength(CODEX_CONFIG.hookEvents.length);
    expect(file.hooks?.["Stop"]?.[0]?.hooks).toEqual([foreignHook]);
    expect(files.get(CONFIG)).toBe(`${USER_CONFIG}\n[features]\nhooks = true\n`);
    expect(await provider.hookState()).toBe("current");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ type: "info" });
    expect(String(dispatch.mock.calls[0]?.[0]?.body)).toContain("/hooks");
  });

  it("installs idempotently: the second install changes nothing and asks nothing", async () => {
    await provider.installHook();
    const written = files.get(HOOKS);
    dispatch.mockClear();

    await provider.installHook();

    expect(files.get(HOOKS)).toBe(written);
    expect(cognoHooksIn(hooksFile(files))).toHaveLength(CODEX_CONFIG.hookEvents.length);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("is outdated while an older Cogno hook sits next to the current ones, and the update clears it", async () => {
    await provider.installHook();
    const file = hooksFile(files);
    file.hooks?.["Stop"]?.push({ hooks: [staleCognoHook] });
    files.set(HOOKS, JSON.stringify(file));

    expect(await provider.hookState()).toBe("outdated");

    await provider.installHook();

    expect(cognoHooksIn(hooksFile(files))).toHaveLength(CODEX_CONFIG.hookEvents.length);
    expect(await provider.hookState()).toBe("current");
  });

  it("is outdated when the hooks are there but Codex has them switched off", async () => {
    await provider.installHook();
    files.set(CONFIG, USER_CONFIG);

    expect(await provider.hookState()).toBe("outdated");

    dispatch.mockClear();
    await provider.installHook();

    expect(await provider.hookState()).toBe("current");
    // The hooks file did not change, so nothing to trust again.
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("is missing without any Cogno hook", async () => {
    expect(await provider.hookState()).toBe("missing");
  });

  it("removes only the Cogno hooks and leaves the Codex config alone", async () => {
    await provider.installHook();

    await provider.removeHook();

    const file = hooksFile(files);
    expect(cognoHooksIn(file)).toHaveLength(0);
    expect(file.hooks?.["Stop"]).toEqual([{ hooks: [foreignHook], matcher: "" }]);
    expect(files.get(CONFIG)).toContain("hooks = true");
    expect(await provider.hookState()).toBe("missing");
  });
});
