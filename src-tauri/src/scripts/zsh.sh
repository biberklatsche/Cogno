# Install only once per shell session
if [[ -n ${COGNO_INJECTED:-} ]]; then
  return 0 2>/dev/null || true
fi
COGNO_INJECTED=1

# State
COGNO_COUNT=${COGNO_COUNT:-0}
COGNO_LAST_EC=0
COGNO_TS=0
COGNO_OSC=""

# Expand ${...} in PROMPT
setopt PROMPT_SUBST

# Hook: runs before each prompt
_cogno_precmd() {
  COGNO_LAST_EC=$?
  ((COGNO_COUNT++))

  # Robust ms timestamp (works on GNU date; fallback to seconds if needed)
  local ts
  ts=$(date +%s%3N 2>/dev/null) || ts=$(date +%s)
  COGNO_TS="$ts"

  # Short hostname
  local host="${HOST%%.*}"

  # Tilde-abbreviated cwd (like %~)
  local cwd
  cwd="$(print -P %~)"

  # Build OSC with REAL ESC and BEL (not "\e" text)
  # ESC = $'\e' , BEL = $'\a'
  COGNO_OSC=$'\e]733;COGNO:PROMPT;'"${COGNO_LAST_EC}|${USER}|${host}|${cwd}|${COGNO_TS}|auto"$'\a'

  return "$COGNO_LAST_EC"
}

# Register precmd hook (avoid duplicate)
autoload -Uz add-zsh-hook
if ! add-zsh-hook -L precmd 2>/dev/null | command grep -q "_cogno_precmd"; then
  add-zsh-hook precmd _cogno_precmd
fi

# Prompt: wrap OSC as non-printing, then "counter@host" + newline
# Use ${HOST%%.*} again so it's consistent even before first hook run
PROMPT="%{${COGNO_OSC}%}
COGNO\${COGNO_COUNT}@${HOST%%.*}
"
