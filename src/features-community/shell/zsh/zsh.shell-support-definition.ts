import { ShellSupportDefinitionContract } from "@cogno/core-sdk";

const zshBootstrapScript = `#!/bin/zsh
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

const zshIntegrationScript = `#!/bin/zsh
# Cogno2 Integration Script for Zsh
# Provides OSC markers, prompt hooks, and shell integration features

if [[ -n "\${COGNO_ZSH_INTEGRATION_LOADED}" ]]; then
  return 0
fi
typeset -g COGNO_ZSH_INTEGRATION_LOADED=1

setopt PROMPT_SUBST
autoload -Uz add-zsh-hook

# State
typeset -g COGNO_COUNT=0
typeset -g COGNO_LAST_CMD=""
typeset -g COGNO_CMD_SEEN=0

# Extract command name: trim, drop leading KEY=VALUE prefixes, take first token
_cogno_extract_command_name() {
  local line="$1"
  line="\${line#\${line%%[![:space:]]*}}"

  local assignment_re='^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+'
  while [[ "$line" =~ $assignment_re ]]; do
    line="\${line#\${MATCH}}"
  done

  line="\${line#\${line%%[![:space:]]*}}"
  if [[ -z "$line" ]]; then
    print -r -- ""
    return
  fi

  print -r -- "\${line%%[[:space:]]*}"
}

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
  local command_exists="false"
  if (( COGNO_CMD_SEEN )); then
    cmd="$COGNO_LAST_CMD"
    local command_name
    command_name="$(_cogno_extract_command_name "$COGNO_LAST_CMD")"
    if [[ -n "$command_name" ]] && whence -w -- "$command_name" >/dev/null 2>&1; then
      command_exists="true"
    fi
  fi

  # Sanitize command for OSC payload
  cmd="\${cmd//\$'\\r'/}"
  cmd="\${cmd//\$'\\n'/\\\\n}"
  cmd="\${cmd//\$'\\e'/}"
  cmd="\${cmd//\$'\\a'/}"
  cmd="\${cmd//;/\\\\;}"
  cmd="\${cmd//|/\\\\|}"

  # Compute and insert commandExists into the existing OSC payload
  local osc=$'\\e]733;COGNO:PROMPT;'"returnCode=\${last_ec};user=\${USER};machine=\${host};directory=\${cwd};id=\${ts};command=\${cmd};commandExists=\${command_exists};"$'\\e\\\\'

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

export const zshShellSupportDefinition: ShellSupportDefinitionContract = {
  shellType: "ZSH",
  profileName: "zsh",
  defaultArgumentsByOs: {
    windows: ["-l", "-i"],
    linux: ["-l", "-i"],
    macos: ["-l", "-i"],
  },
  sortWeightByOs: {
    windows: 4,
    linux: 2,
    macos: 2,
  },
  integrationFiles: [
    {
      relativePath: "zsh/.zshrc",
      content: zshBootstrapScript,
    },
    {
      relativePath: "zsh/bootstrap.zsh",
      content: zshBootstrapScript,
    },
    {
      relativePath: "zsh/integration.zsh",
      content: zshIntegrationScript,
    },
  ],
};
