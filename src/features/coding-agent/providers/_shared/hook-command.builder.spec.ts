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
    expect(parseStatusPingArgs(["question", "claude-code", "Notification", "1700000000"])).toEqual({
      status: "question",
      providerId: "claude-code",
      hookEvent: "Notification",
      seq: 1700000000,
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

  it("reads and sends the PowerShell payload as UTF-8", () => {
    const windows = buildHookCommand("working", "PowerShell", "claude-code", "PreToolUse");
    expect(windows).toContain(
      "New-Object IO.StreamReader([Console]::OpenStandardInput(),[Text.Encoding]::UTF8)",
    );
    expect(windows).toContain("-Body ([Text.Encoding]::UTF8.GetBytes($b))");
    expect(windows).toContain('-ContentType "application/json; charset=utf-8"');
  });

  it("recognises both shell variants of the current command and nothing else", () => {
    const { command, commandWindows } = buildHookCommands("working", "codex", "PreToolUse");
    expect(isCurrentHookCommand(command, "working", "codex", "PreToolUse")).toBe(true);
    expect(isCurrentHookCommand(commandWindows, "working", "codex", "PreToolUse")).toBe(true);
    expect(isCurrentHookCommand(command, "ready", "codex", "PreToolUse")).toBe(false);
    expect(isCurrentHookCommand(undefined, "working", "codex", "PreToolUse")).toBe(false);
  });
});
