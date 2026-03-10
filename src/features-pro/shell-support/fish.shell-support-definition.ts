import { ShellSupportDefinitionContract } from "@cogno/core-sdk";

const fishBootstrapScript = `#!/usr/bin/env fish
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

const fishIntegrationScript = `#!/usr/bin/env fish
# Cogno2 Integration Script for Fish
# Provides OSC markers, prompt hooks, and shell integration features

if set -q COGNO_FISH_INTEGRATION_LOADED
    return
end
set -g COGNO_FISH_INTEGRATION_LOADED 1

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

# Extract command name: trim, drop leading KEY=VALUE prefixes, take first token
function _cogno_extract_command_name
    set -l line $argv[1]
    set line (string trim -l -- $line)

    while string match -rq '^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+' -- $line
        set line (string replace -r '^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+' '' -- $line)
        set line (string trim -l -- $line)
    end

    if test -z "$line"
        echo ""
        return
    end

    string match -r '^[^[:space:]]+' -- $line
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
    set -l command_exists false
    if test -n "$COGNO_LAST_CMD"
        set cmd (_cogno_sanitize_cmd "$COGNO_LAST_CMD")
        set -l command_name (_cogno_extract_command_name "$COGNO_LAST_CMD")
        if test -n "$command_name"
            if type -q -- $command_name
                set command_exists true
            end
        end
    end

    # Compute and insert commandExists into the existing OSC payload
    printf '\\e]733;COGNO:PROMPT;returnCode=%s;user=%s;machine=%s;directory=%s;id=%s;command=%s;commandExists=%s;\\e\\\\' \\
        $last_ec $user $host $cwd $ts $cmd $command_exists

    # Reset for next prompt
    set -g COGNO_LAST_CMD ""

    # Return prompt string
    printf '\\n^^#%s\\n' $COGNO_COUNT
end
`;

export const fishShellSupportDefinition: ShellSupportDefinitionContract = {
  shellType: "Fish",
  profileName: "fish",
  defaultArgumentsByOs: {
    windows: ["-l"],
    linux: ["-l"],
    macos: ["-l"],
  },
  sortWeightByOs: {
    windows: 5,
    linux: 1,
    macos: 1,
  },
  integrationFiles: [
    {
      relativePath: "fish/config.fish",
      content: fishBootstrapScript,
    },
    {
      relativePath: "fish/integration.fish",
      content: fishIntegrationScript,
    },
  ],
};
