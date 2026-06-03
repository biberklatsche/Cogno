import { AgentStatus } from "@cogno/core-api";

export type HookCommands = {
  command: string; // Unix/macOS: bash + curl
  commandWindows: string; // Windows: PowerShell + Invoke-WebRequest
};

export function buildHookCommands(status: AgentStatus): HookCommands {
  return {
    command: buildCurlCommand(status),
    commandWindows: buildWindowsCommand(status),
  };
}

/** Returns the command for the given Cogno shell type (e.g. "PowerShell" → IWR, else curl). */
export function buildHookCommand(status: AgentStatus, shellType?: string): string {
  return shellType === "PowerShell" ? buildWindowsCommand(status) : buildCurlCommand(status);
}

function buildCurlCommand(status: AgentStatus): string {
  const body = `{"action":"coding_agent_status","args":["${status}"],"terminal_id":"$COGNO_TERMINAL_ID"}`;
  return `curl -s -X POST "http://127.0.0.1:$COGNO_PORT/action" -H "Content-Type: application/json" -d "${body.replace(/"/g, '\\"')}"`;
}

function buildWindowsCommand(status: AgentStatus): string {
  // Codex (and Claude Code) run hooks in PowerShell on Windows.
  // Single-quoted JSON body avoids double-quote escaping entirely.
  return `$b='{"action":"coding_agent_status","args":["${status}"],"terminal_id":"'+$env:COGNO_TERMINAL_ID+'"}';Invoke-WebRequest -Uri "http://127.0.0.1:$($env:COGNO_PORT)/action" -Method POST -ContentType "application/json" -Body $b -UseBasicParsing|Out-Null`;
}
