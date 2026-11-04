//! What a coding agent's hook needs to reach Cogno without a terminal
//! environment (ARCHITECTURE.md 3.2): one stable hook script per shell under
//! `<cogno home>/hooks/`, and an endpoint file naming the running instance's
//! port and hook token. The scripts' content may change with the protocol;
//! their paths and the command an agent's config holds never do, so an agent
//! that gates changed hook commands (Codex: `/hooks` trust) keeps running them.

use serde::Serialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const HOOKS_DIR: &str = "hooks";
const ENDPOINT_FILE: &str = "agent-endpoint.json";
const BASH_SCRIPT: &str = "cogno-agent-hook.sh";
const POWERSHELL_SCRIPT: &str = "cogno-agent-hook.ps1";

/// Payloads larger than this are replaced with an `omitted:too-large:<bytes>`
/// marker, well below the server's body limit.
const PAYLOAD_MAX_BYTES: usize = 1_048_576;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentHookScriptPaths {
    pub bash: String,
    pub powershell: String,
}

pub fn endpoint_path(cogno_home: &Path) -> PathBuf {
    cogno_home.join(ENDPOINT_FILE)
}

pub fn script_paths(cogno_home: &Path) -> AgentHookScriptPaths {
    let hooks = cogno_home.join(HOOKS_DIR);
    AgentHookScriptPaths {
        bash: hooks.join(BASH_SCRIPT).display().to_string(),
        powershell: hooks.join(POWERSHELL_SCRIPT).display().to_string(),
    }
}

/// Writes the scripts (only when their content changed) and the endpoint
/// file for this instance. `home_dir_name` is the Cogno home's name under
/// the user's home (`.cogno` or `.cogno-dev`): the scripts resolve it against
/// `$HOME` at run time, so one script serves every shell that reaches the home.
pub fn install(
    cogno_home: &Path,
    home_dir_name: &str,
    port: u16,
    hook_token: &str,
) -> io::Result<()> {
    let hooks = cogno_home.join(HOOKS_DIR);
    fs::create_dir_all(&hooks)?;
    write_if_changed(&hooks.join(BASH_SCRIPT), &bash_script(home_dir_name))?;
    make_executable(&hooks.join(BASH_SCRIPT))?;
    write_if_changed(&hooks.join(POWERSHELL_SCRIPT), &powershell_script(home_dir_name))?;
    write_private(&endpoint_path(cogno_home), &endpoint_json(port, hook_token))
}

/// Takes the endpoint file away: nothing listens any more. A missing file is fine.
pub fn remove_endpoint(cogno_home: &Path) {
    match fs::remove_file(endpoint_path(cogno_home)) {
        Ok(()) | Err(_) => {}
    }
}

fn endpoint_json(port: u16, hook_token: &str) -> String {
    serde_json::json!({
        "port": port,
        "hookToken": hook_token,
        "pid": std::process::id(),
    })
    .to_string()
}

fn write_if_changed(path: &Path, content: &str) -> io::Result<()> {
    if fs::read_to_string(path).ok().as_deref() == Some(content) {
        return Ok(());
    }
    fs::write(path, content)
}

/// The endpoint file holds a secret: readable by the user only.
fn write_private(path: &Path, content: &str) -> io::Result<()> {
    fs::write(path, content)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn make_executable(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o755))?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

/// The bash hook: reads the agent's payload from stdin, finds Cogno and posts
/// `{provider, hookEvent, terminalId, sentAt, payload}` to `/agent-hook`. The
/// terminal's own environment wins when it is there and answers; otherwise
/// the endpoint file names the running instance. Never fails the agent: every
/// exit is 0, and nothing goes to stdout.
fn bash_script(home_dir_name: &str) -> String {
    format!(
        r#"#!/bin/sh
# Cogno agent hook. Usage: cogno-agent-hook.sh <provider> <hook event>
# Written by Cogno on every start; edits are overwritten.
provider="$1"
event="$2"
if [ -t 0 ]; then input=""; else input=$(cat); fi
case "$input" in \{{*|\[*) ;; *) input="\"omitted:not-json\"";; esac
[ ${{#input}} -gt {max_bytes} ] && input="\"omitted:too-large:${{#input}}\""
sent=$(date +%s%3N 2>/dev/null)
case "$sent" in ''|*[!0-9]*) sent=$(perl -MTime::HiRes=time -e 'printf "%d", time*1000' 2>/dev/null);; esac
case "$sent" in ''|*[!0-9]*) sent=$(date +%s)000;; esac
body='{{"provider":"'"$provider"'","hookEvent":"'"$event"'","terminalId":"'"$COGNO_TERMINAL_ID"'","sentAt":'"$sent"',"payload":'"$input"'}}'
post() {{
  printf '%s' "$body" | curl -sf -m 5 -X POST "http://127.0.0.1:$1/agent-hook" -H 'Content-Type: application/json' -H "X-Cogno-Token: $2" --data-binary @- >/dev/null 2>&1
}}
if [ -n "$COGNO_PORT" ] && [ -n "$COGNO_TOKEN" ] && post "$COGNO_PORT" "$COGNO_TOKEN"; then exit 0; fi
endpoint="$HOME/{home_dir_name}/{endpoint_file}"
[ -r "$endpoint" ] || exit 0
port=$(sed -n 's/.*"port":[[:space:]]*\([0-9]*\).*/\1/p' "$endpoint")
token=$(sed -n 's/.*"hookToken":[[:space:]]*"\([^"]*\)".*/\1/p' "$endpoint")
[ -n "$port" ] && [ -n "$token" ] && post "$port" "$token"
exit 0
"#,
        max_bytes = PAYLOAD_MAX_BYTES,
        home_dir_name = home_dir_name,
        endpoint_file = ENDPOINT_FILE,
    )
}

/// The PowerShell twin of `bash_script`. Stdin is decoded as UTF-8 on purpose:
/// `[Console]::In` would use the console code page and garble anything beyond
/// ASCII. It reads stdin only when it is redirected - the inherited console
/// never sends EOF and would hang the hook.
fn powershell_script(home_dir_name: &str) -> String {
    format!(
        r#"# Cogno agent hook. Usage: cogno-agent-hook.ps1 <provider> <hook event>
# Written by Cogno on every start; edits are overwritten.
param([string]$Provider, [string]$HookEvent)
$ErrorActionPreference = 'SilentlyContinue'
if ([Console]::IsInputRedirected) {{
  $payload = (New-Object IO.StreamReader([Console]::OpenStandardInput(), [Text.Encoding]::UTF8)).ReadToEnd()
}} else {{ $payload = '' }}
if ($payload -notmatch '^\s*[\{{\[]') {{ $payload = '"omitted:not-json"' }}
elseif ($payload.Length -gt {max_bytes}) {{ $payload = '"omitted:too-large:' + $payload.Length + '"' }}
$sent = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$body = '{{"provider":"' + $Provider + '","hookEvent":"' + $HookEvent + '","terminalId":"' + $env:COGNO_TERMINAL_ID + '","sentAt":' + $sent + ',"payload":' + $payload + '}}'
$bytes = [Text.Encoding]::UTF8.GetBytes($body)
function Post($port, $token) {{
  try {{
    Invoke-WebRequest -Uri "http://127.0.0.1:$port/agent-hook" -Method POST -ContentType 'application/json; charset=utf-8' -Headers @{{ 'X-Cogno-Token' = $token }} -Body $bytes -TimeoutSec 5 -UseBasicParsing | Out-Null
    return $true
  }} catch {{ return $false }}
}}
if ($env:COGNO_PORT -and $env:COGNO_TOKEN -and (Post $env:COGNO_PORT $env:COGNO_TOKEN)) {{ exit 0 }}
$endpoint = Join-Path $HOME '{home_dir_name}/{endpoint_file}'
if (-not (Test-Path $endpoint)) {{ exit 0 }}
try {{ $e = Get-Content $endpoint -Raw | ConvertFrom-Json }} catch {{ exit 0 }}
if ($e.port -and $e.hookToken) {{ Post $e.port $e.hookToken | Out-Null }}
exit 0
"#,
        max_bytes = PAYLOAD_MAX_BYTES,
        home_dir_name = home_dir_name,
        endpoint_file = ENDPOINT_FILE,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_home() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cogno-agent-hooks-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn writes_scripts_and_endpoint_file() {
        let home = temp_home();
        install(&home, ".cogno", 4321, "secret").unwrap();

        let paths = script_paths(&home);
        let bash = fs::read_to_string(&paths.bash).unwrap();
        let powershell = fs::read_to_string(&paths.powershell).unwrap();
        assert!(bash.contains("/agent-hook"));
        assert!(bash.contains("$HOME/.cogno/agent-endpoint.json"));
        assert!(powershell.contains("'.cogno/agent-endpoint.json'"));

        let endpoint: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(endpoint_path(&home)).unwrap()).unwrap();
        assert_eq!(endpoint["port"], 4321);
        assert_eq!(endpoint["hookToken"], "secret");
        assert_eq!(endpoint["pid"], std::process::id());
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn leaves_an_unchanged_script_untouched() {
        let home = temp_home();
        install(&home, ".cogno", 1, "a").unwrap();
        let bash = PathBuf::from(script_paths(&home).bash);
        let before = fs::metadata(&bash).unwrap().modified().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));

        install(&home, ".cogno", 2, "b").unwrap();

        assert_eq!(fs::metadata(&bash).unwrap().modified().unwrap(), before);
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn removing_the_endpoint_twice_is_fine() {
        let home = temp_home();
        install(&home, ".cogno", 1, "a").unwrap();
        remove_endpoint(&home);
        remove_endpoint(&home);
        assert!(!endpoint_path(&home).exists());
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn the_dev_home_gets_its_own_endpoint_path_in_the_scripts() {
        assert!(bash_script(".cogno-dev").contains("$HOME/.cogno-dev/agent-endpoint.json"));
        assert!(powershell_script(".cogno-dev").contains("'.cogno-dev/agent-endpoint.json'"));
    }
}
