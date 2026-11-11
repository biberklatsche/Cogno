import { CODING_AGENT_HOOK_COMMAND } from "./hook-command";

/**
 * Payloads larger than this are replaced with an `omitted:too-large:<bytes>`
 * marker, well below the 2 MB body limit of Cogno's HTTP server.
 */
const PAYLOAD_MAX_BYTES = 1048576;

/**
 * The sh hook: reads the agent's payload from stdin, finds Cogno and posts the
 * hook as a `/action` message `{command, args: [provider, sentAt, event],
 * terminal_id, payload}`. The terminal's own environment wins when it is there
 * and answers; otherwise the endpoint file names the running instance (an
 * agent's background service has no Cogno environment, ARCHITECTURE.md 3.2).
 * Never fails the agent: every exit is 0, nothing goes to stdout.
 *
 * Reads stdin only when it is not a TTY: the inherited console never sends
 * EOF and would hang the hook.
 */
export function bashHookScript(endpointPath: string): string {
  return `#!/bin/sh
# Cogno coding-agent hook. Usage: sh cogno-agent-hook.sh <provider> <hook event>
# Written by Cogno; edits are overwritten.
provider="$1"
event="$2"
if [ -t 0 ]; then input=""; else input=$(cat); fi
case "$input" in \\{*|\\[*) ;; *) input="\\"omitted:not-json\\"";; esac
[ \${#input} -gt ${PAYLOAD_MAX_BYTES} ] && input="\\"omitted:too-large:\${#input}\\""
sent=$(date +%s%3N 2>/dev/null)
case "$sent" in ''|*[!0-9]*) sent=$(perl -MTime::HiRes=time -e 'printf "%d", time*1000' 2>/dev/null);; esac
case "$sent" in ''|*[!0-9]*) sent=$(date +%s)000;; esac
body='{"command":"${CODING_AGENT_HOOK_COMMAND}","args":["'"$provider"'","'"$sent"'","'"$event"'"],"terminal_id":"'"$COGNO_TERMINAL_ID"'","payload":'"$input"'}'
post() {
  printf '%s' "$body" | curl -sf -m 5 -X POST "http://127.0.0.1:$1/action" -H 'Content-Type: application/json' -H "X-Cogno-Token: $2" --data-binary @- >/dev/null 2>&1
}
if [ -n "$COGNO_PORT" ] && [ -n "$COGNO_TOKEN" ] && post "$COGNO_PORT" "$COGNO_TOKEN"; then exit 0; fi
endpoint="${endpointPath.replace(/\\/g, "/")}"
[ -r "$endpoint" ] || exit 0
port=$(sed -n 's/.*"port":[[:space:]]*\\([0-9]*\\).*/\\1/p' "$endpoint")
token=$(sed -n 's/.*"token":[[:space:]]*"\\([^"]*\\)".*/\\1/p' "$endpoint")
[ -n "$port" ] && [ -n "$token" ] && post "$port" "$token"
exit 0
`;
}

/**
 * The PowerShell twin of {@link bashHookScript}. Stdin is decoded as UTF-8 on
 * purpose: `[Console]::In` would use the console code page and garble
 * anything beyond ASCII. The body goes out as UTF-8 bytes for the same reason.
 */
export function powershellHookScript(endpointPath: string): string {
  return `# Cogno coding-agent hook. Usage: cogno-agent-hook.ps1 <provider> <hook event>
# Written by Cogno; edits are overwritten.
param([string]$Provider, [string]$HookEvent)
$ErrorActionPreference = 'SilentlyContinue'
if ([Console]::IsInputRedirected) {
  $payload = (New-Object IO.StreamReader([Console]::OpenStandardInput(), [Text.Encoding]::UTF8)).ReadToEnd()
} else { $payload = '' }
if ($payload -notmatch '^\\s*[\\{\\[]') { $payload = '"omitted:not-json"' }
elseif ($payload.Length -gt ${PAYLOAD_MAX_BYTES}) { $payload = '"omitted:too-large:' + $payload.Length + '"' }
$sent = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$body = '{"command":"${CODING_AGENT_HOOK_COMMAND}","args":["' + $Provider + '","' + $sent + '","' + $HookEvent + '"],"terminal_id":"' + $env:COGNO_TERMINAL_ID + '","payload":' + $payload + '}'
$bytes = [Text.Encoding]::UTF8.GetBytes($body)
function Post($port, $token) {
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$port/action" -Method POST -ContentType 'application/json; charset=utf-8' -Headers @{ 'X-Cogno-Token' = $token } -Body $bytes -TimeoutSec 5 -UseBasicParsing | Out-Null
    return $true
  } catch { return $false }
}
if ($env:COGNO_PORT -and $env:COGNO_TOKEN -and (Post $env:COGNO_PORT $env:COGNO_TOKEN)) { exit 0 }
$endpoint = '${endpointPath.replace(/'/g, "''")}'
if (-not (Test-Path $endpoint)) { exit 0 }
try { $e = Get-Content $endpoint -Raw | ConvertFrom-Json } catch { exit 0 }
if ($e.port -and $e.token) { Post $e.port $e.token | Out-Null }
exit 0
`;
}
