# Remote hosts

Cogno can run a shell on another machine and show it in a tab like a local
one, with prompt markers, working directory and history. The other machine is
reached over ssh; Cogno opens no port of its own and has no login of its own.

This page covers what both machines need, how to set up the ssh server on
Windows (including its **default shell**, which decides how the start command
has to be written), and the config.

## What you need

| | |
|---|---|
| On the other machine | Cogno installed, and an ssh server you can log in to |
| On this machine | An `ssh` client (part of Windows 10/11, macOS and Linux) and Cogno |
| Between them | The other machine reachable by ssh: same network or a VPN |

Both Cognos must speak the same protocol version. If they do not, connecting
fails with a message naming both versions; update the older one.

## The config

A host gets a name, and a shell profile points at it:

```
remote.hosts.office.destination = lars@office-pc

shell.profiles.office-pwsh.host = office
shell.profiles.office-pwsh.shell_type = PowerShell
shell.profiles.office-pwsh.path = C:\Program Files\PowerShell\7\pwsh.exe
```

- `destination` is what you would type after `ssh`: a host name, `user@host`,
  or an alias from `~/.ssh/config` (ports, jump hosts and keys belong there).
- `path` of the profile is a path **on the other machine**.
- The profile appears next to your local shells. Opening it connects; the
  pane shows `Connecting to office…` until the connection stands, or the
  reason it failed with a Retry button.

### The start command

Cogno runs `cogno server --stdio` on the other machine. That only works if
`cogno` is on the `PATH` of an ssh session there, which it usually is not
after a normal install. Name the binary yourself with `command`:

```
remote.hosts.office.command = C:\Tools\Cogno\cogno.exe server --stdio
```

How the command has to be written depends on the shell the ssh server starts
it in. See [the default shell](#the-default-shell-of-the-windows-ssh-server)
below; these are the forms for each:

| Shell on the other machine | `command` |
|---|---|
| `cmd` (Windows default), path without spaces | `C:\Tools\Cogno\cogno.exe server --stdio` |
| `cmd`, path with spaces | `"C:\Program Files\Cogno\cogno.exe" server --stdio` |
| PowerShell (Windows PowerShell or PowerShell 7) | `& "C:\Program Files\Cogno\cogno.exe" server --stdio` |
| `sh`, `bash`, `zsh` (macOS, Linux) | `/path/to/cogno server --stdio` |

In PowerShell the `&` is required whenever the path is quoted: without it
PowerShell takes the quoted path for a string and reports a syntax error.

The value is written into the config as it is. Backslashes need no escaping,
and quotes inside the value are kept (only a value that both starts and ends
with a quote loses that outer pair).

### Check it by hand first

Before you open a tab, run the same command through `ssh` with `--version`
instead of `server --stdio`. It must print the version and nothing else:

```
ssh lars@office-pc "C:\Tools\Cogno\cogno.exe --version"
cogno 0.5.0
```

If this asks for a password, prints an error, or prints nothing, Cogno will
not get through either. Fix it here, where you see what ssh says.

## Setting up the ssh server on Windows

All of this is done once on the machine you want to reach, in a PowerShell
**run as administrator**.

### 1. Install and start the server

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
```

To have it start with Windows:

```powershell
Set-Service -Name sshd -StartupType Automatic
```

Check that it runs and listens:

```powershell
Get-Service sshd
Test-NetConnection -ComputerName localhost -Port 22
```

### 2. Allow your key

Where the public key goes depends on the account you log in as.

**An account in the Administrators group** (the usual case on your own
machine). Windows reads the keys of such accounts from one shared file, not
from the user's profile:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_rsa.pub | Add-Content C:\ProgramData\ssh\administrators_authorized_keys
icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r /grant "*S-1-5-32-544:F" /grant "*S-1-5-18:F"
```

The second line is not optional: the server ignores the file if anyone but
Administrators and SYSTEM may access it.

**A standard account.** The key goes into the profile, no administrator
needed:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_rsa.pub | Add-Content $env:USERPROFILE\.ssh\authorized_keys
```

Use the public key of the machine you connect **from**. When you set this up
for another machine, copy that machine's `id_rsa.pub` (or `id_ed25519.pub`)
over and add its content instead.

Without a key, ssh asks for the password; Cogno shows that question in a
dialog when it connects.

### The default shell of the Windows ssh server

The ssh server starts every command in one shell. Out of the box that is
`cmd.exe`. It can be changed to PowerShell, and many setup guides do so, so
check which one you have:

```powershell
(Get-ItemProperty HKLM:\SOFTWARE\OpenSSH -ErrorAction SilentlyContinue).DefaultShell
```

No output means `cmd.exe`. Otherwise it prints the path of the shell.

To switch to **Windows PowerShell**:

```powershell
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell `
  -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -PropertyType String -Force
```

To switch to **PowerShell 7**:

```powershell
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell `
  -Value "C:\Program Files\PowerShell\7\pwsh.exe" `
  -PropertyType String -Force
```

To go back to **`cmd.exe`**:

```powershell
Remove-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell
```

The setting applies to connections made after the change.

What it means for Cogno:

- It decides how `remote.hosts.<name>.command` must be written (table above).
  With PowerShell as the default shell, a quoted path needs the leading `&`.
- It does **not** decide which shell your tab runs. That is the profile's
  `path`: a profile can start PowerShell on a machine whose ssh server uses
  `cmd`, and the other way round.

The same host, once for each default shell:

```
# ssh server with cmd.exe as its default shell
remote.hosts.office.destination = lars@office-pc
remote.hosts.office.command = "C:\Program Files\Cogno\cogno.exe" server --stdio

# ssh server with PowerShell as its default shell
remote.hosts.office.destination = lars@office-pc
remote.hosts.office.command = & "C:\Program Files\Cogno\cogno.exe" server --stdio
```

And the check by hand for the PowerShell case, from a Windows machine:

```powershell
ssh lars@office-pc '& "C:\Program Files\Cogno\cogno.exe" --version'
```

## On the machine you connect from (Windows)

ssh refuses a private key that anyone but you can read, and then behaves as
if you had no key:

```
WARNING: UNPROTECTED PRIVATE KEY FILE!
Permissions for 'C:\Users\you/.ssh/id_rsa' are too open.
```

This happens when a group has been given access to your whole profile and the
key inherits it. Give the key permissions of its own (no administrator
needed, you own the file):

```powershell
icacls $env:USERPROFILE\.ssh\id_rsa /inheritance:r /grant:r "$(whoami):F" /grant:r "*S-1-5-18:F" /grant:r "*S-1-5-32-544:F"
```

## macOS and Linux as the other machine

- **macOS:** turn on *Remote Login* (System Settings → General → Sharing), and
  put your public key into `~/.ssh/authorized_keys`. The binary is inside the
  app bundle; find it with `ls /Applications/Cogno.app/Contents/MacOS/` and
  use that path in `command`.
- **Linux:** an ssh server (`openssh-server`) and your key in
  `~/.ssh/authorized_keys`. The machine needs Cogno as it is installed on a
  desktop; a build for servers without a display does not exist yet.

## What works in a remote tab

| | |
|---|---|
| Works | The terminal itself, prompt markers, working directory, command history (kept apart per machine), autocomplete from history, the process panel |
| Not yet | The Git panel, path completion from the file system, coding-agent status, `cogno action run` typed in that shell |
| When the connection breaks | The host's tabs close and Cogno tells you. No shell is left running on the other machine. |

## When connecting fails

| The pane says | What it means |
|---|---|
| `No Cogno answered on the other machine`, followed by what ssh or the shell printed | The start command did not start Cogno. Usually the path in `command` is wrong, or it is written for the other default shell. Run the check by hand. |
| `Permission denied (publickey,…)` | The ssh server does not accept your key. See *Allow your key*; on the machine you connect from, see the note on key permissions. |
| `… speaks protocol N, this one M` | The two Cognos are too far apart in version. Update the older one. |
| `Host '…' is not defined in remote.hosts` | The profile's `host` names a host the config does not have. |

## What has been tested

| | |
|---|---|
| Windows as the other machine, ssh server with `cmd.exe` as default shell | Tested: connection, shell start, input, output, end, and that hanging up ends the shell |
| The start command run through Windows PowerShell and PowerShell 7 | Tested, by starting it through `powershell -c` and `pwsh -c` over ssh. Not tested with the registry setting itself. |
| macOS or Linux as the other machine | Not tested yet |
