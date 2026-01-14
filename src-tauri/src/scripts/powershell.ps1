# Define escape characters
$ESC = [char]27  # Escape character (ASCII 27)
$BEL = [char]7   # Bell character (ASCII 7)

chcp 65001
$OutputEncoding = [System.Console]::OutputEncoding = [System.Console]::InputEncoding = [System.Text.Encoding]::UTF8;
$PSDefaultParameterValues['*:Encoding'] = 'UTF8';

# Save the current prompt function definition
if (-not $global:COGNO_PS1) {
    $global:COGNO_PS1 = (Get-Command prompt).Definition
}

# Check for PSReadLine version and set up command validation handler
if ($PSVersionTable.PSVersion.Major -ge 5) {
        # Redefine the prompt function
        function prompt {
            $return_code = if ($global:LastExitCode -eq $null -or $global:LastExitCode -eq 0) { 0 } else { $global:LastExitCode }
            # Build OSC_PROMPT_START dynamically to include the current directory
            $OSC_PROMPT = "${ESC}]733;COGNO:PROMPT;$return_code|$($env:USERNAME)|$($env:COMPUTERNAME)|$((Get-Location).Path)|$(Get-Date -UFormat %s%3N)|auto${BEL}"
            # Build the prompt text
            $promptText = Invoke-Expression $global:COGNO_PS1

            return "$promptText$OSC_PROMPT"
        }
} else {
  Clear-Host
    Write-Warning "${ESC}[3cCogno advanced features are not available in older versions of PowerShell."
    Write-Warning "${ESC}[3cPlease update to the latest LTS version of PowerShell."
    Write-Warning "${ESC}[3cDownload PowerShell from: https://aka.ms/powershell"
}
