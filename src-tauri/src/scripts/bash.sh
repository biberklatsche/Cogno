source /dev/stdin <<'COGNO_EOF'
# Install only once per shell session
if [[ -n ${COGNO_INJECTED:-} ]]; then
  return 0 2>/dev/null || true
fi
COGNO_INJECTED=1

# State
COGNO_COUNT=${COGNO_COUNT:-0}
COGNO_LAST_EC=0
COGNO_TS=0

# Hook: runs before each prompt
_cogno_prompt_hook() {
  COGNO_LAST_EC=$?
  ((COGNO_COUNT++))

  # ms timestamp; GNU date supports %3N, macOS BSD date usually doesn't.
  # Fallback to seconds if %3N isn't available.
  COGNO_TS=$(date +%s%3N 2>/dev/null) || COGNO_TS=$(date +%s)

  return "$COGNO_LAST_EC"
}

# Prompt template (expanded at prompt-time)
OSC_PROMPT='\[\e]733;COGNO:PROMPT;rc=${COGNO_LAST_EC}|\u|\h|\w|${COGNO_TS}|auto\a\]'

# newline after "<count>@<hostname>"
PS1="${OSC_PROMPT}\n\${COGNO_COUNT}@\h"$'\n'

# Register hook (keep existing PROMPT_COMMAND)
case ";$PROMPT_COMMAND;" in
  *";_cogno_prompt_hook;"*) ;;
  *) PROMPT_COMMAND="_cogno_prompt_hook${PROMPT_COMMAND:+; $PROMPT_COMMAND}" ;;
esac
COGNO_EOF
