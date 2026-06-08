import { AgentStatus } from "@cogno/core-api";

export const CODING_AGENT_STATUS_ACTION = "coding_agent_status";

export type HookCommands = {
  command: string; // Unix/macOS: bash + curl
  commandWindows: string; // Windows: PowerShell + Invoke-WebRequest
};

export function buildHookCommands(status: AgentStatus, providerId: string): HookCommands {
  return {
    command: buildCurlCommand(status, providerId),
    commandWindows: buildWindowsCommand(status, providerId),
  };
}

/**
 * Returns the command for the given Cogno shell type (e.g. "PowerShell" → IWR, else curl).
 * @param stdout When set, the command's own output is suppressed and this string is written to
 * stdout instead — needed for agents (e.g. Antigravity) whose hooks must return specific JSON.
 */
export function buildHookCommand(
  status: AgentStatus,
  shellType: string | undefined,
  providerId: string,
  stdout?: string,
): string {
  return shellType === "PowerShell"
    ? buildWindowsCommand(status, providerId, stdout)
    : buildCurlCommand(status, providerId, stdout);
}

function buildCurlCommand(status: AgentStatus, providerId: string, stdout?: string): string {
  const prefix = `{"command":"${CODING_AGENT_STATUS_ACTION}","args":["${status}","${providerId}"],"terminal_id":"`;
  const out = stdout ? "-o /dev/null " : "";
  const post = `curl -s ${out}-X POST "http://127.0.0.1:$COGNO_PORT/action" -H 'Content-Type: application/json' -d '${prefix}'"$COGNO_TERMINAL_ID"'"}'`;
  return stdout ? `${post}; echo '${stdout}'` : post;
}

function buildWindowsCommand(status: AgentStatus, providerId: string, stdout?: string): string {
  const post = `$b='{"command":"${CODING_AGENT_STATUS_ACTION}","args":["${status}","${providerId}"],"terminal_id":"'+$env:COGNO_TERMINAL_ID+'"}';Invoke-WebRequest -Uri "http://127.0.0.1:$($env:COGNO_PORT)/action" -Method POST -ContentType "application/json" -Body $b -UseBasicParsing|Out-Null`;
  return stdout ? `${post};Write-Output '${stdout}'` : post;
}
