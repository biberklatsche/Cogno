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
 *
 * Only reads stdin when it's not a TTY — `cat` blocks forever if stdin is the inherited
 * console and never sends EOF, which would hang the hook until it's killed, so the status
 * POST never fires.
 */
function bashPayloadCapture(): string {
  return (
    `if [ -t 0 ]; then input=""; else input=$(cat); fi; ` +
    `case "$input" in \\{*|\\[*) ;; *) input="\\"omitted:not-json\\"";; esac; ` +
    `[ \${#input} -gt ${HOOK_PAYLOAD_MAX_BYTES} ] && input="\\"omitted:too-large:\${#input}\\""`
  );
}

/**
 * PowerShell equivalent of {@link bashPayloadCapture}, populating `$payload`.
 * Only reads stdin when it's actually redirected (a real pipe) — `[Console]::In.ReadToEnd()`
 * blocks forever if stdin is the inherited console/PTY and never sends EOF, which would hang
 * the hook until it's killed, so the status POST never fires.
 */
function powershellPayloadCapture(): string {
  return (
    `if ([Console]::IsInputRedirected) { $payload=[Console]::In.ReadToEnd() } else { $payload='' };` +
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
  const prefix = `{"command":"${CODING_AGENT_STATUS_ACTION}","args":["${status}","${providerId}","${hookEvent}","`;
  // Build the JSON body into _b first so the curl call is a simple "$_b" expansion —
  // this avoids any ambiguity around single-quote injection from $input.
  const bodyVar = `_b='${prefix}'"$seq"'"],"terminal_id":"'"$COGNO_TERMINAL_ID"'","payload":'"$input"'}'`;
  const curl = `curl -s -X POST "http://127.0.0.1:$COGNO_PORT/action" -H 'Content-Type: application/json' -d "$_b"`;
  const guardedCurl = `seq=$(date +%s); ${bashPayloadCapture()}; ${bodyVar}; [ -n "$COGNO_PORT" ] && ${curl} >/dev/null 2>&1`;

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
    `$seq=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds();` +
    `${powershellPayloadCapture()};` +
    `$b='{"command":"${CODING_AGENT_STATUS_ACTION}","args":["${status}","${providerId}","${hookEvent}","'+$seq+'"],"terminal_id":"'+$env:COGNO_TERMINAL_ID+'","payload":'+$payload+'}'`;
  const request = `Invoke-WebRequest -Uri "http://127.0.0.1:$($env:COGNO_PORT)/action" -Method POST -ContentType "application/json" -Body $b -UseBasicParsing|Out-Null`;
  const guardedRequest = `try { if ($env:COGNO_PORT) { ${body};${request} } } catch { Write-Error $_ }`;

  // Same guard as the bash variant, expressed for PowerShell. The caught error is written to
  // stderr for diagnostics, but we still force a zero exit status (";exit 0") — without it, a
  // failed Invoke-WebRequest leaves $? false even though the error was reported, and
  // `powershell -Command` reports exit code 1 for what is just a fire-and-forget status ping.
  return stdout ? `${guardedRequest};Write-Output '${stdout}'` : `${guardedRequest};exit 0`;
}
