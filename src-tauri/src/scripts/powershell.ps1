# Install only once per session
if ($global:COGNO_INJECTED) { return }
$global:COGNO_INJECTED = $true

# State
if ($null -eq $global:COGNO_COUNT) { $global:COGNO_COUNT = 0 }
$global:COGNO_LAST_SUCCESS = $true
$global:COGNO_LASTEXITCODE = 0

function global:prompt {
    # Capture last command status
    $global:COGNO_LAST_SUCCESS = $?
    $global:COGNO_LASTEXITCODE = $global:LASTEXITCODE

    # Increment counter per prompt draw (≈ per command)
    $global:COGNO_COUNT++

    # Timestamp in ms
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

    $user     = $env:USERNAME
    $computer = $env:COMPUTERNAME
    $pwdPath  = (Get-Location).Path

    # OSC (ESC ... BEL)
    $esc = [char]27
    $bel = [char]7

    # rc: 0/1 from PowerShell success; lec: native exit code
    $rc  = if ($global:COGNO_LAST_SUCCESS) { 0 } else { 1 }
    $lec = $global:COGNO_LASTEXITCODE

    $osc = "$esc]733;COGNO:PROMPT;rc=$rc|lec=$lec|$user|$computer|$pwdPath|$ts|auto$bel"

    # Prefix with newline after "<count>@<computer>"
    return "${osc}`nCOGNO$($global:COGNO_COUNT)@$computer`n"
}
