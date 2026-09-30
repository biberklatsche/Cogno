import { describe, expect, it } from "vitest";
import {
  buildHookCommand,
  buildHookCommands,
  isCurrentHookCommand,
  parseStatusPingArgs,
} from "./hook-command.builder";

describe("hook-command.builder", () => {
  it("writes the ping args in the order parseStatusPingArgs reads them", () => {
    const { command, commandWindows } = buildHookCommands(
      "question",
      "claude-code",
      "Notification",
    );
    for (const built of [command, commandWindows]) {
      expect(built).toContain('"args":["question","claude-code","Notification","');
    }
    expect(
      parseStatusPingArgs(["question", "claude-code", "Notification", "1700000000123"]),
    ).toEqual({
      status: "question",
      providerId: "claude-code",
      hookEvent: "Notification",
      seq: 1700000000123,
    });
  });

  it("falls back to a ready status, empty names and no sequence for missing args", () => {
    expect(parseStatusPingArgs(undefined)).toEqual({
      status: "ready",
      providerId: "",
      hookEvent: "",
      seq: 0,
    });
    expect(parseStatusPingArgs(["nonsense"]).status).toBe("ready");
  });

  it("stamps a ping to the millisecond in both shells, so a tool hook and the stop after it keep their order", () => {
    const { command, commandWindows } = buildHookCommands("working", "claude-code", "PostToolUse");
    expect(command).toContain("seq=$(date +%s%3N 2>/dev/null)");
    expect(command).toContain("seq=$(date +%s)000");
    expect(commandWindows).toContain("$seq=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()");
  });

  it("reads and sends the PowerShell payload as UTF-8", () => {
    const windows = buildHookCommand("working", "PowerShell", "claude-code", "PreToolUse");
    expect(windows).toContain(
      "New-Object IO.StreamReader([Console]::OpenStandardInput(),[Text.Encoding]::UTF8)",
    );
    expect(windows).toContain("-Body ([Text.Encoding]::UTF8.GetBytes($b))");
    expect(windows).toContain('-ContentType "application/json; charset=utf-8"');
  });

  it("sends the bash body through stdin, so a large payload does not hit the command-line limit", () => {
    const bash = buildHookCommand("working", "Bash", "claude-code", "PostToolUse");
    expect(bash).toContain(`printf '%s' "$_b" | curl`);
    expect(bash).toContain("--data-binary @-");
    expect(bash).not.toContain('-d "$_b"');
  });

  it("sends the launch token Cogno's HTTP server requires, in both shells", () => {
    const { command, commandWindows } = buildHookCommands("working", "claude-code", "Stop");
    expect(command).toContain(`-H "X-Cogno-Token: $COGNO_TOKEN"`);
    expect(commandWindows).toContain("-Headers @{'X-Cogno-Token'=$env:COGNO_TOKEN}");
  });

  it("recognises both shell variants of the current command and nothing else", () => {
    const { command, commandWindows } = buildHookCommands("working", "codex", "PreToolUse");
    expect(isCurrentHookCommand(command, "working", "codex", "PreToolUse")).toBe(true);
    expect(isCurrentHookCommand(commandWindows, "working", "codex", "PreToolUse")).toBe(true);
    expect(isCurrentHookCommand(command, "ready", "codex", "PreToolUse")).toBe(false);
    expect(isCurrentHookCommand(undefined, "working", "codex", "PreToolUse")).toBe(false);
  });
});
