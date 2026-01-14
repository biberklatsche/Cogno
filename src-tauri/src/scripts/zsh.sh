# Congo start
# OSC 733;A - Command Start
OSC_PROMPT=$'%{\e]733;COGNO:PROMPT;%?|%n|%m|%d|$(date +%s%3N)|auto\a%}'

if [ -z "$COGNO_PS1" ]
  then COGNO_PS1=$PROMPT
fi

# Combine the dynamic OSC_PROMPT and original PS1
PS1="${OSC_PROMPT}${COGNO_PS1}"
