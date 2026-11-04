import type { Fs, Paths } from "@cogno/platform";
import { describe, expect, it, vi } from "vitest";
import { CODING_AGENT_HOOK_COMMAND } from "./hook-command";
import { HookScriptPathsService } from "./hook-script-paths.service";
import { bashHookScript, powershellHookScript } from "./hook-scripts";

function inMemoryFs(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  const fs = {
    exists: vi.fn(async (path: string) => files.has(path) || path.endsWith("coding-agents")),
    mkdir: vi.fn(async () => {}),
    readTextFile: vi.fn(async (path: string) => files.get(path) ?? ""),
    writeTextFile: vi.fn(async (path: string, data: string) => {
      files.set(path, data);
    }),
  };
  return { fs, files };
}

const paths = {
  cognoHomeDir: async () => "C:/home/.cogno",
  join: async (...parts: string[]) => parts.join("/"),
} as unknown as Paths;

describe("HookScriptPathsService", () => {
  it("writes both scripts next to the endpoint file and names them", async () => {
    const { fs, files } = inMemoryFs();
    const service = new HookScriptPathsService(fs as unknown as Fs, paths);

    expect(await service.get()).toEqual({
      bash: "C:/home/.cogno/coding-agents/cogno-agent-hook.sh",
      powershell: "C:/home/.cogno/coding-agents/cogno-agent-hook.ps1",
    });
    expect(files.get("C:/home/.cogno/coding-agents/cogno-agent-hook.sh")).toBe(
      bashHookScript("C:/home/.cogno/endpoint.json"),
    );
  });

  it("leaves a script with the current content alone, and writes once per run", async () => {
    const { fs } = inMemoryFs({
      "C:/home/.cogno/coding-agents/cogno-agent-hook.sh": bashHookScript(
        "C:/home/.cogno/endpoint.json",
      ),
    });
    const service = new HookScriptPathsService(fs as unknown as Fs, paths);

    await service.get();
    await service.get();

    expect(fs.writeTextFile).toHaveBeenCalledTimes(1);
    expect(fs.writeTextFile).toHaveBeenCalledWith(
      "C:/home/.cogno/coding-agents/cogno-agent-hook.ps1",
      expect.any(String),
    );
  });

  it("tries again after a failed write", async () => {
    const { fs } = inMemoryFs();
    fs.writeTextFile.mockRejectedValueOnce(new Error("read-only"));
    const service = new HookScriptPathsService(fs as unknown as Fs, paths);

    await expect(service.get()).rejects.toThrow("read-only");
    await expect(service.get()).resolves.toBeDefined();
  });
});

describe("hook scripts", () => {
  it("post the hook as a /action message, from the environment first, else the endpoint file", () => {
    const bash = bashHookScript("C:\\home\\.cogno\\endpoint.json");
    expect(bash).toContain(`"command":"${CODING_AGENT_HOOK_COMMAND}"`);
    expect(bash).toContain("/action");
    expect(bash).toContain('post "$COGNO_PORT" "$COGNO_TOKEN"');
    expect(bash).toContain('endpoint="C:/home/.cogno/endpoint.json"');

    const powershell = powershellHookScript("C:\\home\\.cogno\\endpoint.json");
    expect(powershell).toContain(`"command":"${CODING_AGENT_HOOK_COMMAND}"`);
    expect(powershell).toContain("$endpoint = 'C:\\home\\.cogno\\endpoint.json'");
    expect(powershell).toContain("$e.token");
  });
});
