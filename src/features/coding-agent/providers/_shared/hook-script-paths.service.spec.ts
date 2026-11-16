import type { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import type { Fs, OsPlatform, Paths } from "@cogno/platform";
import { describe, expect, it, vi } from "vitest";
import { ConfigFileService } from "./config-file.service";
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

const STARTER = "C:/home/.cogno/bin/cogno.cmd";

const paths = {
  cognoHomeDir: async () => "C:/home/.cogno",
  cognoStarterPath: async () => STARTER,
  join: async (...parts: string[]) => parts.join("/"),
} as unknown as Paths;

const config = { getConfiguration: () => ({}) } as unknown as ApplicationConfigurationPort;
const os = { platform: () => "macos" } as unknown as OsPlatform;

describe("HookScriptPathsService", () => {
  it("writes both scripts into the Cogno home and names them", async () => {
    const { fs, files } = inMemoryFs();
    const service = new HookScriptPathsService(
      new ConfigFileService(fs as unknown as Fs, paths),
      paths,
      config,
      os,
    );

    expect(await service.get()).toEqual({
      bash: "C:/home/.cogno/coding-agents/cogno-agent-hook.sh",
      powershell: "C:/home/.cogno/coding-agents/cogno-agent-hook.ps1",
    });
    expect(files.get("C:/home/.cogno/coding-agents/cogno-agent-hook.sh")).toBe(
      bashHookScript(STARTER),
    );
  });

  it("leaves a script with the current content alone, and writes once per run", async () => {
    const { fs } = inMemoryFs({
      "C:/home/.cogno/coding-agents/cogno-agent-hook.sh": bashHookScript(STARTER),
    });
    const service = new HookScriptPathsService(
      new ConfigFileService(fs as unknown as Fs, paths),
      paths,
      config,
      os,
    );

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
    const service = new HookScriptPathsService(
      new ConfigFileService(fs as unknown as Fs, paths),
      paths,
      config,
      os,
    );

    await expect(service.get()).rejects.toThrow("Cannot write");
    await expect(service.get()).resolves.toBeDefined();
  });
});

describe("HookScriptPathsService.shell", () => {
  const shellOf = (platform: string, configuration: Record<string, unknown>) =>
    new HookScriptPathsService(
      {} as ConfigFileService,
      paths,
      { getConfiguration: () => configuration } as unknown as ApplicationConfigurationPort,
      { platform: () => platform } as unknown as OsPlatform,
    ).shell();
  const defaultProfile = (shellType: string) => ({
    shell: { default: "main", profiles: { main: { shell_type: shellType } } },
  });

  it("follows the default profile, PowerShell as Windows PowerShell on Windows and pwsh elsewhere", () => {
    expect(shellOf("windows", defaultProfile("PowerShell"))).toBe("powershell");
    expect(shellOf("macos", defaultProfile("PowerShell"))).toBe("pwsh");
    expect(shellOf("windows", defaultProfile("Bash"))).toBe("sh");
  });

  it("falls back to the platform's shell without a profile", () => {
    expect(shellOf("windows", {})).toBe("powershell");
    expect(shellOf("linux", {})).toBe("sh");
  });
});

describe("hook scripts", () => {
  const starter = String.raw`C:\Users\o'neil\.cogno\bin\cogno.cmd`;

  it("hand the payload to the starter's `hook` command, with provider and event (sh)", () => {
    const bash = bashHookScript(starter);
    expect(bash).toContain(`"C:/Users/o'neil/.cogno/bin/cogno.cmd" hook "$1" "$2"`);
    expect(bash).toContain("exit 0");
  });

  it("hand it on as UTF-8, quoting the path for PowerShell", () => {
    const powershell = powershellHookScript(starter);
    expect(powershell).toContain(
      String.raw`$payload | & 'C:\Users\o''neil\.cogno\bin\cogno.cmd' hook $Provider $HookEvent`,
    );
    expect(powershell).toContain("$OutputEncoding = New-Object Text.UTF8Encoding $false");
  });
});
