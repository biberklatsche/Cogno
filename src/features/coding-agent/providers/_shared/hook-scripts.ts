/**
 * The sh hook: hands the agent's payload (stdin) to `cogno hook`, which gives
 * it to the host of this machine; the host passes it on to the Cogno that
 * shows the terminal, wherever that Cogno runs (ARCHITECTURE.md 3.2). The
 * starter is Cogno's stable command in its home, whichever version is
 * installed. Never fails the agent: every exit is 0, nothing goes to stdout.
 */
export function bashHookScript(starterPath: string): string {
  // Single quotes keep every character of the path but the quote itself.
  const quoted = `'${starterPath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
  return `#!/bin/sh
# Cogno coding-agent hook. Usage: sh cogno-agent-hook.sh <provider> <hook event>
# Written by Cogno; edits are overwritten.
${quoted} hook "$1" "$2" >/dev/null 2>&1
exit 0
`;
}

/**
 * The PowerShell twin of {@link bashHookScript}. Stdin is read as UTF-8 and
 * handed on as UTF-8: `[Console]::In` would use the console code page, and
 * PowerShell pipes to a native command in `$OutputEncoding`, which is not
 * UTF-8 by default.
 */
export function powershellHookScript(starterPath: string): string {
  return `# Cogno coding-agent hook. Usage: cogno-agent-hook.ps1 <provider> <hook event>
# Written by Cogno; edits are overwritten.
param([string]$Provider, [string]$HookEvent)
$ErrorActionPreference = 'SilentlyContinue'
if ([Console]::IsInputRedirected) {
  $payload = (New-Object IO.StreamReader([Console]::OpenStandardInput(), [Text.Encoding]::UTF8)).ReadToEnd()
} else { $payload = '' }
$OutputEncoding = New-Object Text.UTF8Encoding $false
$payload | & '${starterPath.replace(/'/g, "''")}' hook $Provider $HookEvent *> $null
exit 0
`;
}
