import {Fs} from "../_tauri/fs";
import {Environment} from "../common/environment/environment";
import {Logger} from "../_tauri/logger";
import {Shells} from "../_tauri/shells";

const INTEGRATION_VERSION = "1.0.23";

/**
 * Manages shell integration scripts in ~/.cogno2/shell-integration
 * (or ~/.cogno2-dev/shell-integration in dev mode)
 */
export class ShellIntegrationWriter {

    /**
     * Ensures shell integration scripts are installed and up-to-date
     * Only installs scripts for shells that are actually available on the system
     */
    static async ensure(): Promise<void> {
        const integrationRoot = await this.getIntegrationRoot();

        // Check if update needed
        const needsUpdate = await this.needsUpdate(integrationRoot);
        if (!needsUpdate) {
            return;
        }

        Logger.info('Installing/updating shell integration scripts...');

        try {
            // Get available shells from system
            const availableShells = await Shells.load();
            const shellTypes = new Set(availableShells.map(s => s.shell_type));

            Logger.info(`Found shells: ${Array.from(shellTypes).join(', ')}`);

            // Create base directories
            await this.createBaseDirectories(integrationRoot);

            // Write scripts only for available shells
            if (shellTypes.has('Bash') || shellTypes.has('GitBash')) {
                await this.writeBashScripts(integrationRoot);
            }
            if (shellTypes.has('ZSH')) {
                await this.writeZshScripts(integrationRoot);
            }
            if (shellTypes.has('Fish')) {
                await this.writeFishScripts(integrationRoot);
            }
            if (shellTypes.has('PowerShell')) {
                await this.writePwshScripts(integrationRoot);
            }

            // Write version file (only after successful script writes)
            await this.writeVersion(integrationRoot);

            // Log update
            await this.logUpdate(integrationRoot);

            Logger.info('Shell integration scripts installed successfully');
        } catch (error) {
            Logger.error('Failed to install shell integration: ' + error);
            throw error;
        }
    }

    static async getIntegrationRoot(): Promise<string> {
        const cognoHome = Environment.configDir();
        return `${cognoHome}/shell-integration`;
    }

    private static async needsUpdate(integrationRoot: string): Promise<boolean> {
        const versionFile = `${integrationRoot}/VERSION`;

        if (!await Fs.exists(versionFile)) {
            return true;
        }

        const currentVersion = await Fs.readTextFile(versionFile);
        return currentVersion.trim() !== INTEGRATION_VERSION;
    }

    private static async createBaseDirectories(integrationRoot: string): Promise<void> {
        // Create base directories
        const dirs = [
            integrationRoot,
            `${integrationRoot}/logs`,
        ];

        for (const dir of dirs) {
            if (!await Fs.exists(dir)) {
                await Fs.mkdir(dir);
            }
        }
    }

    private static async ensureShellDirectory(integrationRoot: string, shellDir: string): Promise<void> {
        const dir = `${integrationRoot}/${shellDir}`;
        if (!await Fs.exists(dir)) {
            await Fs.mkdir(dir);
        }
    }

    private static async writeVersion(integrationRoot: string): Promise<void> {
        await Fs.writeTextFile(`${integrationRoot}/VERSION`, INTEGRATION_VERSION);
    }

    private static async logUpdate(integrationRoot: string): Promise<void> {
        const logFile = `${integrationRoot}/logs/updates.log`;
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const entry = `[${timestamp}] Updated shell integration to version ${INTEGRATION_VERSION}\n`;

        let existing = '';
        if (await Fs.exists(logFile)) {
            existing = await Fs.readTextFile(logFile);
        }

        await Fs.writeTextFile(logFile, existing + entry);
    }

    private static async writeBashScripts(integrationRoot: string): Promise<void> {
        await this.ensureShellDirectory(integrationRoot, 'bash');
        const bashDir = `${integrationRoot}/bash`;

        // cogno.bashrc
        await Fs.writeTextFile(`${bashDir}/cogno.bashrc`, BASH_BOOTSTRAP);

        // integration.bash
        await Fs.writeTextFile(`${bashDir}/integration.bash`, BASH_INTEGRATION);
    }

    private static async writeZshScripts(integrationRoot: string): Promise<void> {
        await this.ensureShellDirectory(integrationRoot, 'zsh');
        const zshDir = `${integrationRoot}/zsh`;

        // Write .zshrc that zsh will load from ZDOTDIR
        await Fs.writeTextFile(`${zshDir}/.zshrc`, ZSH_BOOTSTRAP);

        // Also keep bootstrap.zsh for backwards compatibility
        await Fs.writeTextFile(`${zshDir}/bootstrap.zsh`, ZSH_BOOTSTRAP);

        // integration.zsh
        await Fs.writeTextFile(`${zshDir}/integration.zsh`, ZSH_INTEGRATION);
    }

    private static async writeFishScripts(integrationRoot: string): Promise<void> {
        await this.ensureShellDirectory(integrationRoot, 'fish');
        const fishDir = `${integrationRoot}/fish`;

        // config.fish
        await Fs.writeTextFile(`${fishDir}/config.fish`, FISH_BOOTSTRAP);

        // integration.fish
        await Fs.writeTextFile(`${fishDir}/integration.fish`, FISH_INTEGRATION);
    }

    private static async writePwshScripts(integrationRoot: string): Promise<void> {
        await this.ensureShellDirectory(integrationRoot, 'pwsh');
        const pwshDir = `${integrationRoot}/pwsh`;

        // integration.ps1
        await Fs.writeTextFile(`${pwshDir}/integration.ps1`, PWSH_INTEGRATION);
    }
}

// Script templates as constants
const BASH_BOOTSTRAP = `#!/bin/bash
# Cogno2 Bootstrap Script for Bash
# This script is loaded as the rcfile when shell integration is enabled

# Guard against double loading
if [[ -n "\${COGNO_BASH_BOOTSTRAPPED}" ]]; then
    return 0
fi
export COGNO_BASH_BOOTSTRAPPED=1

# Logging function
_cogno_log() {
    if [[ -n "\${COGNO_LOG_DIR}" && -n "\${COGNO_SESSION_ID}" ]]; then
        local log_file="\${COGNO_LOG_DIR}/shell-bootstrap-\${COGNO_SESSION_ID}.log"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$log_file" 2>/dev/null
    fi
}

_cogno_log "Bash bootstrap started"

# Use login-shell PATH as baseline if provided by backend
if [[ -n "\${COGNO_LOGIN_PATH}" ]]; then
    _cogno_log "Applying COGNO_LOGIN_PATH baseline"
    export PATH="\${COGNO_LOGIN_PATH}"
fi

# Optionally load user's Bash startup files (only if COGNO_ALLOW_USER_RC=1)
# We run with --rcfile, so login startup files are not loaded automatically.
# Load them manually to replicate login shell behavior.
if [[ "\${COGNO_ALLOW_USER_RC}" == "1" ]]; then
    # Load system-wide profile first (like -l does)
    if [[ -f /etc/profile ]]; then
        _cogno_log "Loading /etc/profile"
        source /etc/profile
    fi

    # Load user profile
    if [[ -f "\${HOME}/.bash_profile" ]]; then
        _cogno_log "Loading user .bash_profile"
        source "\${HOME}/.bash_profile"
    elif [[ -f "\${HOME}/.bash_login" ]]; then
        _cogno_log "Loading user .bash_login"
        source "\${HOME}/.bash_login"
    elif [[ -f "\${HOME}/.profile" ]]; then
        _cogno_log "Loading user .profile"
        source "\${HOME}/.profile"
    fi

    # Load interactive rc file
    if [[ -f "\${HOME}/.bashrc" ]]; then
        _cogno_log "Loading user .bashrc"
        source "\${HOME}/.bashrc"
    fi
fi

# Apply PATH prefix after user startup files, so Cogno CLI stays available.
if [[ -n "\${COGNO_PATH_PREFIX}" ]]; then
    _cogno_log "Applying PATH prefix: \${COGNO_PATH_PREFIX}"
    export PATH="\${COGNO_PATH_PREFIX}:\${PATH}"
fi

# Ensure "cogno" command resolves directly to the current executable path.
if [[ -n "\${COGNO_CLI_PATH}" ]] && ! command -v cogno >/dev/null 2>&1; then
    _cogno_log "Installing cogno function for \${COGNO_CLI_PATH}"
    cogno() {
        "\${COGNO_CLI_PATH}" "$@"
    }
fi

# Load Cogno integration
if [[ -n "\${COGNO_INTEGRATION_ROOT}" ]]; then
    _cogno_integration_script="\${COGNO_INTEGRATION_ROOT}/bash/integration.bash"
    if [[ -f "\${_cogno_integration_script}" ]]; then
        _cogno_log "Loading integration script"
        source "\${_cogno_integration_script}"
    else
        _cogno_log "WARNING: Integration script not found: \${_cogno_integration_script}"
    fi
fi

_cogno_log "Bash bootstrap completed"
`;

const BASH_INTEGRATION = `#!/bin/bash
# Cogno2 Integration Script for Bash
# Provides OSC markers, prompt hooks, and shell integration features

# State variables
COGNO_COUNT=0
COGNO_LAST_CMD=""
COGNO_CMD_SEEN=0

# Sanitize command for OSC payload
_cogno_sanitize_cmd() {
  local s="$1"
  # Remove CR
  s="\${s//\$'\\r'/}"
  # Replace LF with \\n (Bash 3.2 compatible)
  s="\${s//\$'\\n'/\\\\n}"
  # Drop ESC and BEL (use octal escapes for Bash 3.2)
  s="\${s//$(printf '\\033')/}"
  s="\${s//$(printf '\\007')/}"
  # Escape semicolons and pipes
  s="\${s//;/\\\\;}"
  s="\${s//|/\\\\|}"
  echo "$s"
}

# Preexec equivalent - capture command before execution
_cogno_preexec() {
  # Get the actual input from history
  local actual_input
  actual_input=$(history 1 | sed 's/^[ ]*[0-9]*[ ]*//')

  # Filter internal commands
  if [[ "$actual_input" != "_cogno_precmd"* &&
        "$actual_input" != "_cogno_preexec"* &&
        "$actual_input" != "COGNO_"* ]]; then

    COGNO_LAST_CMD="$actual_input"
    COGNO_CMD_SEEN=1
  fi
}

# Precmd equivalent - run before each prompt
_cogno_precmd() {
  local last_ec=$?

  # Increment counter FIRST (so first prompt is #1, matching zsh)
  COGNO_COUNT=$((COGNO_COUNT + 1))

  local ts="$COGNO_COUNT"
  local host="\${HOSTNAME%%.*}"
  local user="\${USER:-\${USERNAME:-$(whoami)}}"
  local cwd="$PWD"

  local cmd=""
  if [ "$COGNO_CMD_SEEN" -eq 1 ]; then
    cmd="$(_cogno_sanitize_cmd "$COGNO_LAST_CMD")"
  fi

  # OSC payload - use printf for better Bash 3.2 compatibility
  printf '\\033]733;COGNO:PROMPT;returnCode=%s;user=%s;machine=%s;directory=%s;id=%s;command=%s;\\033\\\\' \\
    "$last_ec" "$user" "$host" "$cwd" "$ts" "$cmd"

  # Reset for next prompt
  COGNO_CMD_SEEN=0
  COGNO_LAST_CMD=""

  return $last_ec
}

# Set up hooks
trap '_cogno_preexec' DEBUG

# PROMPT_COMMAND must be a simple string in Bash 3.2
PROMPT_COMMAND='_cogno_precmd'

# Set prompt - Bash 3.2 doesn't expand variables in PS1 as easily
PS1='\\n^^#\${COGNO_COUNT}\\n'
`;

const ZSH_BOOTSTRAP = `#!/bin/zsh
# Cogno2 Bootstrap Script for Zsh
# This script is loaded as .zshrc in the custom ZDOTDIR

# Guard against double loading
if [[ -n "\${COGNO_ZSH_BOOTSTRAPPED}" ]]; then
    return 0
fi
export COGNO_ZSH_BOOTSTRAPPED=1

# Logging function
_cogno_log() {
    if [[ -n "\${COGNO_LOG_DIR}" && -n "\${COGNO_SESSION_ID}" ]]; then
        local log_file="\${COGNO_LOG_DIR}/shell-bootstrap-\${COGNO_SESSION_ID}.log"
        print -r -- "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$log_file" 2>/dev/null
    fi
}

_cogno_log "Zsh bootstrap started"

# Use login-shell PATH as baseline if provided by backend
if [[ -n "\${COGNO_LOGIN_PATH}" ]]; then
    _cogno_log "Applying COGNO_LOGIN_PATH baseline"
    export PATH="\${COGNO_LOGIN_PATH}"
fi

# Optionally load user's Zsh startup files (only if COGNO_ALLOW_USER_RC=1)
# We run with custom ZDOTDIR, so ~/.zshenv/.zprofile are not loaded automatically.
if [[ "\${COGNO_ALLOW_USER_RC}" == "1" ]]; then
    if [[ -f "\${HOME}/.zshenv" ]]; then
        _cogno_log "Loading user .zshenv"
        source "\${HOME}/.zshenv"
    fi
    if [[ -f "\${HOME}/.zprofile" ]]; then
        _cogno_log "Loading user .zprofile"
        source "\${HOME}/.zprofile"
    fi
    if [[ -f "\${HOME}/.zshrc" ]]; then
        _cogno_log "Loading user .zshrc"
        source "\${HOME}/.zshrc"
    fi
fi

# Apply PATH prefix after user startup files, so Cogno CLI stays available.
if [[ -n "\${COGNO_PATH_PREFIX}" ]]; then
    _cogno_log "Applying PATH prefix: \${COGNO_PATH_PREFIX}"
    export PATH="\${COGNO_PATH_PREFIX}:\${PATH}"
fi

# Ensure "cogno" command resolves directly to the current executable path.
if [[ -n "\${COGNO_CLI_PATH}" ]] && ! command -v cogno >/dev/null 2>&1; then
    _cogno_log "Installing cogno function for \${COGNO_CLI_PATH}"
    cogno() {
        "\${COGNO_CLI_PATH}" "$@"
    }
fi

# Load Cogno integration
if [[ -n "\${COGNO_INTEGRATION_ROOT}" ]]; then
    _cogno_integration_script="\${COGNO_INTEGRATION_ROOT}/zsh/integration.zsh"
    if [[ -f "\${_cogno_integration_script}" ]]; then
        _cogno_log "Loading integration script"
        source "\${_cogno_integration_script}"
    else
        _cogno_log "WARNING: Integration script not found: \${_cogno_integration_script}"
    fi
fi

_cogno_log "Zsh bootstrap completed"
`;

const ZSH_INTEGRATION = `#!/bin/zsh
# Cogno2 Integration Script for Zsh
# Provides OSC markers, prompt hooks, and shell integration features

setopt PROMPT_SUBST
autoload -Uz add-zsh-hook

# State
typeset -g COGNO_COUNT=0
typeset -g COGNO_LAST_CMD=""
typeset -g COGNO_CMD_SEEN=0

_cogno_preexec() {
  # $1 = command line as entered
  COGNO_LAST_CMD="$1"
  COGNO_CMD_SEEN=1
}

_cogno_precmd() {
  local last_ec=$?

  ((COGNO_COUNT++))

  local ts="$COGNO_COUNT"

  local host="\${HOST%%.*}"
  local cwd="$PWD"

  local cmd=""
  if (( COGNO_CMD_SEEN )); then
    cmd="$COGNO_LAST_CMD"
  fi

  # Sanitize command for OSC payload
  cmd="\${cmd//\$'\\r'/}"
  cmd="\${cmd//\$'\\n'/\\\\n}"
  cmd="\${cmd//\$'\\e'/}"
  cmd="\${cmd//\$'\\a'/}"
  cmd="\${cmd//;/\\\\;}"
  cmd="\${cmd//|/\\\\|}"

  # OSC payload (cmd is empty if no command was entered)
  local osc=$'\\e]733;COGNO:PROMPT;'"returnCode=\${last_ec};user=\${USER};machine=\${host};directory=\${cwd};id=\${ts};command=\${cmd};"$'\\e\\\\'

  print -n -r -- "$osc"

  # Reset for next prompt
  COGNO_CMD_SEEN=0
  COGNO_LAST_CMD=""

  return $last_ec
}

add-zsh-hook preexec _cogno_preexec
add-zsh-hook precmd  _cogno_precmd

PROMPT=$'\\n^^#\${COGNO_COUNT}\\n'
`;

const FISH_BOOTSTRAP = `#!/usr/bin/env fish
# Cogno2 Bootstrap Script for Fish
# This script is loaded as config.fish in the custom XDG_CONFIG_HOME

# Guard against double loading
if set -q COGNO_FISH_BOOTSTRAPPED
    exit 0
end
set -gx COGNO_FISH_BOOTSTRAPPED 1

# Logging function
function _cogno_log
    if set -q COGNO_LOG_DIR; and set -q COGNO_SESSION_ID
        set -l log_file "$COGNO_LOG_DIR/shell-bootstrap-$COGNO_SESSION_ID.log"
        echo "["(date '+%Y-%m-%d %H:%M:%S')"] $argv" >> $log_file 2>/dev/null
    end
end

_cogno_log "Fish bootstrap started"

# Optionally load user's config.fish (only if COGNO_ALLOW_USER_RC=1)
if test "$COGNO_ALLOW_USER_RC" = "1"; and test -f "$HOME/.config/fish/config.fish"
    _cogno_log "Loading user config.fish"
    source "$HOME/.config/fish/config.fish"
end

# Apply PATH prefix after user startup files, so Cogno CLI stays available.
if set -q COGNO_PATH_PREFIX
    _cogno_log "Applying PATH prefix: $COGNO_PATH_PREFIX"
    # Split PATH prefix by colon and prepend to PATH
    for p in (string split : $COGNO_PATH_PREFIX)
        set -gx PATH $p $PATH
    end
end

# Ensure "cogno" command resolves directly to the current executable path.
if set -q COGNO_CLI_PATH
    if not type -q cogno
        _cogno_log "Installing cogno function for $COGNO_CLI_PATH"
        function cogno
            $COGNO_CLI_PATH $argv
        end
    end
end

# Load Cogno integration
if set -q COGNO_INTEGRATION_ROOT
    set -l integration_script "$COGNO_INTEGRATION_ROOT/fish/integration.fish"
    if test -f $integration_script
        _cogno_log "Loading integration script"
        source $integration_script
    else
        _cogno_log "WARNING: Integration script not found: $integration_script"
    end
end

_cogno_log "Fish bootstrap completed"
`;

const FISH_INTEGRATION = `#!/usr/bin/env fish
# Cogno2 Integration Script for Fish
# Provides OSC markers, prompt hooks, and shell integration features

# State
set -g COGNO_COUNT 0
set -g COGNO_LAST_CMD ""

function _cogno_sanitize_cmd
    set -l s $argv[1]
    # Remove problematic characters
    set s (string replace -a -r '\\r' '' $s)
    set s (string replace -a -r '\\n' '\\\\n' $s)
    set s (string replace -a -r '\\e' '' $s)
    set s (string replace -a -r '\\a' '' $s)
    set s (string replace -a ';' '\\\\;' $s)
    set s (string replace -a '|' '\\\\|' $s)
    echo $s
end

function _cogno_preexec --on-event fish_preexec
    set -g COGNO_LAST_CMD $argv[1]
end

function fish_prompt
    # Save exit status first
    set -l last_ec $status

    # Increment counter first (so first prompt is #1)
    set -g COGNO_COUNT (math $COGNO_COUNT + 1)

    set -l ts $COGNO_COUNT
    set -l host (hostname -s 2>/dev/null; or hostname)
    set -l user $USER
    set -l cwd $PWD

    set -l cmd ""
    if test -n "$COGNO_LAST_CMD"
        set cmd (_cogno_sanitize_cmd "$COGNO_LAST_CMD")
    end

    # OSC payload
    printf '\\e]733;COGNO:PROMPT;returnCode=%s;user=%s;machine=%s;directory=%s;id=%s;command=%s;\\e\\\\' \\
        $last_ec $user $host $cwd $ts $cmd

    # Reset for next prompt
    set -g COGNO_LAST_CMD ""

    # Return prompt string
    printf '\\n^^#%s\\n' $COGNO_COUNT
end
`;

const PWSH_INTEGRATION = `# Cogno2 Integration Script for PowerShell
# Provides OSC markers, prompt hooks, and shell integration features

# Guard against double loading
if ($env:COGNO_PWSH_BOOTSTRAPPED -eq "1") {
    return
}
$env:COGNO_PWSH_BOOTSTRAPPED = "1"

# Logging function
function Write-CognoLog {
    param([string]$Message)

    if ($env:COGNO_LOG_DIR -and $env:COGNO_SESSION_ID) {
        $logFile = Join-Path $env:COGNO_LOG_DIR "shell-bootstrap-$($env:COGNO_SESSION_ID).log"
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "[$timestamp] $Message" | Out-File -Append -FilePath $logFile -ErrorAction SilentlyContinue
    }
}

Write-CognoLog "PowerShell integration started"

# Optionally load user's profile (only if COGNO_ALLOW_USER_RC=1)
if ($env:COGNO_ALLOW_USER_RC -eq "1") {
    $userProfile = $PROFILE.CurrentUserAllHosts
    if (Test-Path $userProfile) {
        Write-CognoLog "Loading user profile: $userProfile"
        . $userProfile
    }
}

# Apply PATH prefix after user startup files, so Cogno CLI stays available.
if ($env:COGNO_PATH_PREFIX) {
    Write-CognoLog "Applying PATH prefix: $($env:COGNO_PATH_PREFIX)"
    $env:Path = "$($env:COGNO_PATH_PREFIX);$($env:Path)"
}

# Ensure "cogno" command resolves directly to the current executable path.
if ($env:COGNO_CLI_PATH -and -not (Get-Command cogno -ErrorAction SilentlyContinue)) {
    Write-CognoLog "Installing cogno function for $($env:COGNO_CLI_PATH)"
    function global:cogno {
        & $env:COGNO_CLI_PATH @args
    }
}

$esc = [char]27
$bel = [char]7

# State
$global:COGNO_COUNT = 0
$global:COGNO_LAST_CMD = ""

function Sanitize-CognoCommand {
    param([string]$Command)

    $s = $Command
    $s = $s -replace "\`r", ""
    $s = $s -replace "\`n", "\\n"
    $s = $s -replace "[$esc]", ""
    $s = $s -replace "[$bel]", ""
    $s = $s -replace ";", "\\;"
    $s = $s -replace "\\|", "\\|"

    return $s
}

# Pre-Execution Hook via PSReadLine
if ($null -ne (Get-Module -ListAvailable PSReadLine)) {
    Set-PSReadLineKeyHandler -Key Enter -ScriptBlock {
        $line = ""
        $cursor = 0
        [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$line, [ref]$cursor)

        if (-not [string]::IsNullOrWhiteSpace($line)) {
            $global:COGNO_LAST_CMD = $line
            $global:COGNO_CMD_SEEN = $true
        }
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}

# Prompt function
function prompt {
    $lastEc = $LASTEXITCODE
    if ($null -eq $lastEc) { $lastEc = 0 }

    $global:COGNO_COUNT++

    $ts = $global:COGNO_COUNT
    $host_name = $env:COMPUTERNAME
    $user = $env:USERNAME
    $cwd = $PWD.Path

    $cmd = ""
    if ($global:COGNO_LAST_CMD) {
        $cmd = Sanitize-CognoCommand $global:COGNO_LAST_CMD
    }

    # OSC payload
    $osc = "\${esc}]733;COGNO:PROMPT;returnCode=$lastEc;user=$user;machine=$host_name;directory=$cwd;id=$ts;command=$cmd;\${bel}"
    Write-Host -NoNewline $osc

    # Reset for next prompt
    $global:COGNO_LAST_CMD = ""

    # Return prompt string
    return "\`n^^#$ts\`n"
}

Write-CognoLog "PowerShell integration completed"
`;
