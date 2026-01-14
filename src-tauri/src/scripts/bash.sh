# OSC 733;A - Command Start
OSC_PROMPT='\[\e]733;COGNO:PROMPT;$?|`whoami`|`hostname`|`pwd`|$(date +%s%3N)|auto\a\]'

if [ -z "$COGNO_PS1" ]
  then COGNO_PS1=$PS1
fi

PS1="${OSC_PROMPT}${COGNO_PS1}"
