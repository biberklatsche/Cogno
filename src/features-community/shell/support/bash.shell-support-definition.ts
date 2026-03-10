import { ShellSupportDefinitionContract } from "@cogno/core-sdk";

const bashBootstrapScript = `#!/bin/bash
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

const bashIntegrationScript = `#!/bin/bash
# Cogno2 Integration Script for Bash
# Provides OSC markers, prompt hooks, and shell integration features

if [[ -n "\${COGNO_BASH_INTEGRATION_LOADED}" ]]; then
  return 0
fi
export COGNO_BASH_INTEGRATION_LOADED=1

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

# Extract command name: trim, drop leading KEY=VALUE prefixes, take first token
_cogno_extract_command_name() {
  local line="$1"
  line="\${line#"\${line%%[![:space:]]*}"}"

  local assignment_re='^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+'
  while [[ "$line" =~ $assignment_re ]]; do
    line="\${line#\${BASH_REMATCH[0]}}"
  done

  line="\${line#"\${line%%[![:space:]]*}"}"
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi

  echo "\${line%%[[:space:]]*}"
}

# Preexec equivalent - capture command before execution
_cogno_preexec() {
  # Get the actual input from history
  local actual_input
  actual_input=$(history 1 | sed 's/^[ ]*[0-9]*[ ]*//')
  if [[ -z "$actual_input" ]]; then
    actual_input="$BASH_COMMAND"
  fi

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
  local command_exists="false"
  if [ "$COGNO_CMD_SEEN" -eq 1 ]; then
    cmd="$(_cogno_sanitize_cmd "$COGNO_LAST_CMD")"
    local command_name
    command_name="$(_cogno_extract_command_name "$COGNO_LAST_CMD")"
    if [[ -n "$command_name" ]] && [[ -n "$(type -t -- "$command_name" 2>/dev/null)" ]]; then
      command_exists="true"
    fi
  fi

  # Compute and insert commandExists into the existing OSC payload
  printf '\\033]733;COGNO:PROMPT;returnCode=%s;user=%s;machine=%s;directory=%s;id=%s;command=%s;commandExists=%s;\\033\\\\' \\
    "$last_ec" "$user" "$host" "$cwd" "$ts" "$cmd" "$command_exists"

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

export const bashShellSupportDefinition: ShellSupportDefinitionContract = {
  shellType: "Bash",
  profileName: "bash",
  defaultArgumentsByOs: {
    windows: [],
    linux: [],
    macos: [],
  },
  sortWeightByOs: {
    windows: 3,
    linux: 3,
    macos: 3,
  },
  integrationFiles: [
    {
      relativePath: "bash/cogno.bashrc",
      content: bashBootstrapScript,
    },
    {
      relativePath: "bash/integration.bash",
      content: bashIntegrationScript,
    },
  ],
};
