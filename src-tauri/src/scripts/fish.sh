# State variables
set -g COGNO_COUNT 0
set -g COGNO_LAST_CMD ""
set -g COGNO_CMD_SEEN 0

function _cogno_preexec --on-event fish_preexec
    # $argv[1] = command line as entered
    set -g COGNO_LAST_CMD "$argv[1]"
    set -g COGNO_CMD_SEEN 1
end

function _cogno_precmd --on-event fish_prompt
    set -l last_ec $status
    set -g COGNO_COUNT (math $COGNO_COUNT + 1)

    set -l ts $COGNO_COUNT

    set -l host (hostname -s)
    set -l cwd $PWD

    set -l cmd ""
    if test $COGNO_CMD_SEEN -eq 1
        set cmd $COGNO_LAST_CMD
    end

    # sanitize command for OSC payload
    set cmd (string replace -a \r "" -- $cmd)
    set cmd (string replace -a \n "\\n" -- $cmd)
    set cmd (string replace -a \e "" -- $cmd)
    set cmd (string replace -a \a "" -- $cmd)
    set cmd (string replace -a ";" "\\;" -- $cmd)
    set cmd (string replace -a "|" "\\|" -- $cmd)

    # OSC payload (c is empty if no command was entered)
    printf '\e]733;COGNO:PROMPT;returnCode=%s;user=%s;machine=%s;directory=%s;id=%s;command=%s;\e\\' \
        $last_ec $USER $host $cwd $ts $cmd

    # reset for next prompt
    set -g COGNO_CMD_SEEN 0
    set -g COGNO_LAST_CMD ""

    return $last_ec
end

function fish_prompt
    printf '\n^^#%s\n' $COGNO_COUNT
end
