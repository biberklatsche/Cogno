import { AgentStatus, BackendOsContract } from "@cogno/core-api";

export function buildHookCommand(status: AgentStatus, platform: BackendOsContract): string {
  if (platform === "windows") {
    return buildPowerShellCommand(status);
  }
  return buildCurlCommand(status);
}

function buildCurlCommand(status: AgentStatus): string {
  const body = `{"action":"coding_agent_status","args":["${status}"],"terminal_id":"$COGNO_TERMINAL_ID"}`;
  return `curl -s -X POST "http://127.0.0.1:$COGNO_PORT/action" -H "Content-Type: application/json" -d "${body.replace(/"/g, '\\"')}"`;
}

function buildPowerShellCommand(status: AgentStatus): string {
  return [
    `$body = '{"action":"coding_agent_status","args":["${status}"],"terminal_id":"' + $env:COGNO_TERMINAL_ID + '"}'`,
    `Invoke-WebRequest -Uri "http://127.0.0.1:$env:COGNO_PORT/action" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing | Out-Null`,
  ].join("; ");
}
