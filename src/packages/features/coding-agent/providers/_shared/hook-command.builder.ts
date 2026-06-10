import { AgentStatus } from "@cogno/core-api";

export const CODING_AGENT_STATUS_ACTION = "coding_agent_status";

/** Payloads larger than this are replaced with an "omitted:too-large:<bytes>" marker. */
export const HOOK_PAYLOAD_MAX_BYTES = 65536;

export type HookCommands = {
  command: string; // Unix/macOS: bash + curl
  commandWindows: string; // Windows: PowerShell + Invoke-WebRequest
};

export function buildHookCommands(
  status: AgentStatus,
  providerId: string,
  hookEvent: string,
): HookCommands {
  return {
    command: buildCurlCommand(status, providerId, hookEvent),
    commandWindows: buildWindowsCommand(status, providerId, hookEvent),
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
  hookEvent: string,
  stdout?: string,
): string {
  return shellType === "PowerShell"
    ? buildWindowsCommand(status, providerId, hookEvent, stdout)
    : buildCurlCommand(status, providerId, hookEvent, stdout);
}

/**
 * Whether a hook command stored on disk matches what Cogno would currently generate.
 * Compares against both shell variants (the install-time shell type isn't persisted),
 * so any drift in the protocol/format — not just a missing hook — is detected and
 * triggers reinstallation via `installHook`.
 */
export function isCurrentHookCommand(
  command: string | undefined,
  status: AgentStatus,
  providerId: string,
  hookEvent: string,
): boolean {
  if (!command) return false;
  const { command: bash, commandWindows } = buildHookCommands(status, providerId, hookEvent);
  return command === bash || command === commandWindows;
}

/**
 * Bash snippet that reads the hook's stdin (the agent's JSON event payload) into `$input` and
 * replaces it with a quoted "omitted:..." marker if it doesn't look like JSON or is too large.
 * The result is always a single, valid JSON value (object/array or string), so it can be
 * embedded verbatim as the `payload` field of the status POST body.
 */
function bashPayloadCapture(): string {
  return (
    `input=$(cat); ` +
    `case "$input" in \\{*|\\[*) ;; *) input="\\"omitted:not-json\\"";; esac; ` +
    `[ \${#input} -gt ${HOOK_PAYLOAD_MAX_BYTES} ] && input="\\"omitted:too-large:\${#input}\\""`
  );
}

/** PowerShell equivalent of {@link bashPayloadCapture}, populating `$payload`. */
function powershellPayloadCapture(): string {
  return (
    `$payload=[Console]::In.ReadToEnd();` +
    `if ($payload -notmatch '^\\s*[\\{\\[]') { $payload='"omitted:not-json"' } ` +
    `elseif ($payload.Length -gt ${HOOK_PAYLOAD_MAX_BYTES}) { $payload='"omitted:too-large:'+$payload.Length+'"' }`
  );
}

function buildCurlCommand(
  status: AgentStatus,
  providerId: string,
  hookEvent: string,
  stdout?: string,
): string {
  const prefix = `{"command":"${CODING_AGENT_STATUS_ACTION}","args":["${status}","${providerId}","${hookEvent}"],"terminal_id":"`;
  const data = `'${prefix}'"$COGNO_TERMINAL_ID"'","payload":'"$input"'}'`;
  const curl = `curl -s -X POST "http://127.0.0.1:$COGNO_PORT/action" -H 'Content-Type: application/json' -d ${data}`;
  const guardedCurl = `${bashPayloadCapture()}; [ -n "$COGNO_PORT" ] && ${curl} >/dev/null 2>&1`;

  // Guard against terminals without Cogno's env vars (e.g. opened outside Cogno) and
  // force a zero exit status — this is a fire-and-forget status ping, never the agent's
  // business, so a missing/unreachable Cogno server must not surface as a hook error.
  return stdout ? `${guardedCurl}; echo '${stdout}'` : `${guardedCurl}; true`;
}

function buildWindowsCommand(
  status: AgentStatus,
  providerId: string,
  hookEvent: string,
  stdout?: string,
): string {
  const body =
    `${powershellPayloadCapture()};` +
    `$b='{"command":"${CODING_AGENT_STATUS_ACTION}","args":["${status}","${providerId}","${hookEvent}"],"terminal_id":"'+$env:COGNO_TERMINAL_ID+'","payload":'+$payload+'}'`;
  const request = `Invoke-WebRequest -Uri "http://127.0.0.1:$($env:COGNO_PORT)/action" -Method POST -ContentType "application/json" -Body $b -UseBasicParsing|Out-Null`;
  const guardedRequest = `try { if ($env:COGNO_PORT) { ${body};${request} } } catch {}`;

  // Same guard + error-swallowing as the bash variant, expressed for PowerShell.
  return stdout ? `${guardedRequest};Write-Output '${stdout}'` : guardedRequest;
}
