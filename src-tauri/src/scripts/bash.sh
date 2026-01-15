#!/bin/bash

# State variables
COGNO_COUNT=0
COGNO_LAST_CMD=""
COGNO_CMD_SEEN=0

# Sanitize command for OSC payload
_cogno_sanitize_cmd() {
  local s="$1"
  # Remove CR
  s="${s//$'\r'/}"
  # Replace LF with \n (Bash 3.2 compatible)
  s="${s//$'\n'/\\n}"
  # Drop ESC and BEL (use octal escapes for Bash 3.2)
  s="${s//$(printf '\033')/}"
  s="${s//$(printf '\007')/}"
  # Escape semicolons and pipes
  s="${s//;/\\;}"
  s="${s//|/\\|}"
  echo "$s"
}

# Preexec equivalent - capture command before execution
_cogno_preexec() {
  # Filter out internal commands
  if [[ "$BASH_COMMAND" != "_cogno_precmd"* &&
        "$BASH_COMMAND" != "_cogno_preexec"* &&
        "$BASH_COMMAND" != "COGNO_"* ]]; then
    COGNO_LAST_CMD="$BASH_COMMAND"
    COGNO_CMD_SEEN=1
  fi
}

# Precmd equivalent - run before each prompt
_cogno_precmd() {
  local last_ec=$?
  COGNO_COUNT=$((COGNO_COUNT + 1))

  local ts="$COGNO_COUNT"
  local host="${HOSTNAME%%.*}"
  local cwd="$PWD"

  local cmd=""
  if [ "$COGNO_CMD_SEEN" -eq 1 ]; then
    cmd="$(_cogno_sanitize_cmd "$COGNO_LAST_CMD")"
  fi

  # OSC payload - use printf for better Bash 3.2 compatibility
  printf '\033]733;COGNO:PROMPT;r=%s;u=%s;m=%s;d=%s;t=%s;c=%s;\033\\' \
    "$last_ec" "$USER" "$host" "$cwd" "$ts" "$cmd"

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
PS1='\nCOGNO${COGNO_COUNT}@\h\n\n'
