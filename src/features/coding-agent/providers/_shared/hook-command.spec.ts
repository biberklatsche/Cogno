import { describe, expect, it } from "vitest";
import { hookCommand, hookStateOf, isCognoHookCommand, isCurrentHookCommand } from "./hook-command";

const scripts = {
  bash: "C:\\Users\\me\\.cogno\\hooks\\cogno-agent-hook.sh",
  powershell: "C:\\Users\\me\\.cogno\\hooks\\cogno-agent-hook.ps1",
};

describe("hookCommand", () => {
  it("runs the bash script with forward slashes, provider and event", () => {
    expect(hookCommand(scripts, "sh", "codex", "Stop")).toBe(
      'sh "C:/Users/me/.cogno/hooks/cogno-agent-hook.sh" codex Stop',
    );
  });

  it("runs the PowerShell script without a profile and past the execution policy", () => {
    expect(hookCommand(scripts, "powershell", "codex", "Stop")).toBe(
      'powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\me\\.cogno\\hooks\\cogno-agent-hook.ps1" codex Stop',
    );
    expect(hookCommand(scripts, "pwsh", "codex", "Stop")).toMatch(/^pwsh /);
  });

  it("prints what an agent expects on stdout after the script", () => {
    expect(hookCommand(scripts, "sh", "antigravity", "Stop", '{"decision":""}')).toMatch(
      /; echo '\{"decision":""\}'$/,
    );
    expect(hookCommand(scripts, "powershell", "antigravity", "Stop", "{}")).toMatch(
      /; Write-Output '\{\}'$/,
    );
  });
});

describe("isCurrentHookCommand", () => {
  it("recognises every shell's variant of the current command and nothing else", () => {
    for (const shell of ["sh", "powershell", "pwsh"] as const) {
      const command = hookCommand(scripts, shell, "codex", "PreToolUse");
      expect(isCurrentHookCommand(command, scripts, "codex", "PreToolUse")).toBe(true);
      expect(isCurrentHookCommand(command, scripts, "codex", "Stop")).toBe(false);
    }
    expect(isCurrentHookCommand(undefined, scripts, "codex", "PreToolUse")).toBe(false);
  });

  it("sees a moved script directory as not current", () => {
    const command = hookCommand(scripts, "sh", "codex", "Stop");
    const moved = { bash: "/other/cogno-agent-hook.sh", powershell: scripts.powershell };
    expect(isCurrentHookCommand(command, moved, "codex", "Stop")).toBe(false);
  });
});

describe("isCognoHookCommand", () => {
  it("knows this version's script and the inline command of earlier versions", () => {
    expect(isCognoHookCommand(hookCommand(scripts, "sh", "codex", "Stop"))).toBe(true);
    expect(
      isCognoHookCommand(
        `[ -n "$COGNO_PORT" ] && curl -d '{"command":"coding_agent_status"}' …; true`,
      ),
    ).toBe(true);
    expect(isCognoHookCommand("echo foreign")).toBe(false);
    expect(isCognoHookCommand(undefined)).toBe(false);
  });
});

describe("hookStateOf", () => {
  it("is outdated only when a Cogno hook of some version is there", () => {
    expect(hookStateOf(true, true)).toBe("current");
    expect(hookStateOf(false, true)).toBe("outdated");
    expect(hookStateOf(false, false)).toBe("missing");
  });
});
