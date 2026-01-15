# ------------------------------------------------------------
# Install only once per shell session
# ------------------------------------------------------------
if [[ -n ${COGNO_INJECTED:-} ]]; then
  return 0 2>/dev/null || true
fi
COGNO_INJECTED=1

# ------------------------------------------------------------
# State
# ------------------------------------------------------------
COGNO_COUNT=${COGNO_COUNT:-0}
COGNO_LAST_EC=0
COGNO_TS=0

# ------------------------------------------------------------
# Make ${...} expand inside PROMPT
# ------------------------------------------------------------
setopt PROMPT_SUBST

# ------------------------------------------------------------
# Hook: runs before each prompt
# - captures exit code of last command
# - increments counter
# - sets ms timestamp
# ------------------------------------------------------------
_cogno_precmd() {
  COGNO_LAST_EC=$?
  ((COGNO_COUNT++))
  COGNO_TS=$(date +%s%3N)
  return "$COGNO_LAST_EC"
}

# Register precmd hook (use built-in if available; fallback if not)
if (( $+functions[add-zsh-hook] )); then
  autoload -Uz add-zsh-hook
  # Avoid double registration
  if ! add-zsh-hook -L precmd 2>/dev/null | command grep -q "_cogno_precmd"; then
    add-zsh-hook precmd _cogno_precmd
  fi
else
  # Fallback: chain into existing precmd function (rare)
  if (( $+functions[precmd] )); then
    eval "precmd() { _cogno_precmd; ${functions[precmd]} }"
  else
    precmd() { _cogno_precmd }
  fi
fi

# ------------------------------------------------------------
# Prompt template
# zsh prompt escapes:
#   %n = username
#   %m = hostname (short)
#   %~ = cwd (with ~)
# We wrap non-printing OSC with %{ %} (zsh equivalent of \[ \])
# ------------------------------------------------------------
OSC_PROMPT='%{\e]733;COGNO:PROMPT;${COGNO_LAST_EC}|%n|%m|%~|${COGNO_TS}|auto\a%}'

# Newline after "<count>@<host>"
PROMPT="${OSC_PROMPT}\${COGNO_COUNT}@%m
"
