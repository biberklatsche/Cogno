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

  local host="${HOST%%.*}"
  local cwd="$PWD"

  local cmd=""
  if (( COGNO_CMD_SEEN )); then
    cmd="$COGNO_LAST_CMD"
  fi

  # sanitize command for OSC payload
  cmd="${cmd//$'\r'/}"
  cmd="${cmd//$'\n'/\\n}"
  cmd="${cmd//$'\e'/}"
  cmd="${cmd//$'\a'/}"
  cmd="${cmd//;/\\;}"
  cmd="${cmd//|/\\|}"

  # OSC payload (c is empty if no command was entered)
  local osc=$'\e]733;COGNO:PROMPT;'"r=${last_ec};u=${USER};m=${host};d=${cwd};t=${ts};c=${cmd};"$'\e\\'

  print -n -r -- "$osc"

  # reset for next prompt
  COGNO_CMD_SEEN=0
  COGNO_LAST_CMD=""

  return $last_ec
}

add-zsh-hook preexec _cogno_preexec
add-zsh-hook precmd  _cogno_precmd

PROMPT=$'\nCOGNO${COGNO_COUNT}@${HOST%%.*}\n'
