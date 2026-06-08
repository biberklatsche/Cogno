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

/** Returns the command for the given Cogno shell type (e.g. "PowerShell" → IWR, else curl). */
export function buildHookCommand(status: AgentStatus, shellType: string | undefined, providerId: string): string {
  return shellType === "PowerShell"
    ? buildWindowsCommand(status, providerId)
    : buildCurlCommand(status, providerId);
}

/**
 * Whether a hook command stored on disk matches what Cogno would currently generate.
 * Compares against both shell variants (the install-time shell type isn't persisted),
 * so any drift in the protocol/format — not just a missing hook — is detected and
 * triggers reinstallation via `installHook`.
 */
export function isCurrentHookCommand(command: string | undefined, status: AgentStatus, providerId: string): boolean {
  if (!command) return false;
  const { command: bash, commandWindows } = buildHookCommands(status, providerId);
  return command === bash || command === commandWindows;
}

function buildCurlCommand(status: AgentStatus, providerId: string): string {
  const prefix = `{"command":"${CODING_AGENT_STATUS_ACTION}","args":["${status}","${providerId}"],"terminal_id":"`;
  const curl = `curl -s -X POST "http://127.0.0.1:$COGNO_PORT/action" -H 'Content-Type: application/json' -d '${prefix}'"$COGNO_TERMINAL_ID"'"}'`;
  // Guard against terminals without Cogno's env vars (e.g. opened outside Cogno) and
  // force a zero exit status — this is a fire-and-forget status ping, never the agent's
  // business, so a missing/unreachable Cogno server must not surface as a hook error.
  return `[ -n "$COGNO_PORT" ] && ${curl} >/dev/null 2>&1; true`;
}

function buildWindowsCommand(status: AgentStatus, providerId: string): string {
  const body = `$b='{"command":"${CODING_AGENT_STATUS_ACTION}","args":["${status}","${providerId}"],"terminal_id":"'+$env:COGNO_TERMINAL_ID+'"}'`;
  const request = `Invoke-WebRequest -Uri "http://127.0.0.1:$($env:COGNO_PORT)/action" -Method POST -ContentType "application/json" -Body $b -UseBasicParsing|Out-Null`;
  // Same guard + error-swallowing as the bash variant, expressed for PowerShell.
  return `try { if ($env:COGNO_PORT) { ${body};${request} } } catch {}`;
}
