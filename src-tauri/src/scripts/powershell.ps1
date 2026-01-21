# Variablen für Steuerzeichen definieren
$esc = [char]27
$bel = [char]7

# State Management
$global:COGNO_COUNT = 0
$global:COGNO_LAST_CMD = ""
$global:COGNO_CMD_SEEN = $false

# Pre-Execution Hook via PSReadLine
if ($null -ne (Get-Module -ListAvailable PSReadLine)) {
    Set-PSReadLineKeyHandler -Key Enter -ScriptBlock {
        $line = ""
        $cursor = 0
        [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$line, [ref]$cursor)

        if (-not [string]::IsNullOrWhiteSpace($line)) {
            $global:COGNO_LAST_CMD = $line
            $global:COGNO_CMD_SEEN = $true
        }
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}

function prompt {
    # Letzten Status ermitteln
    $last_ec = if ($global:?) { 0 } else { $LASTEXITCODE }
    if ($null -eq $last_ec) { $last_ec = 0 }

    $global:COGNO_COUNT++

    # Metadaten sammeln
    $ts = $global:COGNO_COUNT
    $user = $env:USERNAME
    $hostName = $env:COMPUTERNAME
    $cwd = $ExecutionContext.SessionState.Path.CurrentLocation.Path

    $cmd = ""
    if ($global:COGNO_CMD_SEEN) {
    $cmd = $global:COGNO_LAST_CMD
    }

    # Bereinigung des Befehls (Sanitizing)
    if ($cmd) {
    $cmd = $cmd -replace "`r", ""
    $cmd = $cmd -replace "`n", "\\n"
    $cmd = $cmd -replace "[$esc]", ""
    $cmd = $cmd -replace "[$bel]", ""
    $cmd = $cmd -replace ";", "\\;"
    $cmd = $cmd -replace "\|", "\\|"
    }

    # OSC Payload zusammenbauen
    # Format: ESC]733;...BEL
    $osc = "${esc}]733;COGNO:PROMPT;r=$last_ec;u=$user;m=$hostName;d=$cwd;t=$ts;c=$cmd;${bel}"

    # Sequenz an das Terminal senden
    Write-Host -NoNewline $osc

    # Reset für den nächsten Prompt
    $global:COGNO_CMD_SEEN = $false
    $global:COGNO_LAST_CMD = ""

    # Sichtbarer Prompt
    # `n ist das PowerShell-Kürzel für Newline
    Write-Output "`nCOGNO$($global:COGNO_COUNT)@$hostName `n"
}
