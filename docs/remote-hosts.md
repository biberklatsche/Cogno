# Remote hosts

Cogno can show the shells that run in the Cogno of another machine, each in
a tab like a local one, with prompt markers, working directory and history:
you leave the office, open the laptop and go on in the same shells. The other
machine is reached over ssh; Cogno opens no port of its own and has no login
of its own.

This page covers what both machines need, how to set up the ssh server on
Windows (including its **default shell**, which decides how the start command
has to be written), and the config.

## What you need

| | |
|---|---|
| On the other machine | Cogno **running**, and an ssh server you can log in to |
| On this machine | An `ssh` client (part of Windows 10/11, macOS and Linux) and Cogno |
| Between them | The other machine reachable by ssh: same network or a VPN |

Both Cognos must speak the same protocol version. If they do not, connecting
fails with a message naming both versions; update the older one.

## The config

A remote is a name and where ssh connects. Add it in the **Remote** panel of
the side menu (the `+` button), or write it into the config yourself, which
is where the panel puts it:

```
remote.hosts.office.destination = lars@office-pc
```

- The name consists of letters, digits, `-` and `_`.
- The command field starts with the default start command (below); change
  it only when the other machine needs another one. Left as it is, the
  remote names no command and follows the default.
- `destination` is what you would type after `ssh`: a host name, `user@host`,
  or an alias from `~/.ssh/config` (ports, jump hosts and keys belong there).

## The Remote panel

The panel lists your remotes. Under a connected one are the shells that run
there, sorted the way the Cogno they belong to shows them: workspace, tab,
shell. Each level folds away with its arrow.

- **Connect** sets up the ssh connection; what ssh asks (a password, a new
  host key) appears in a dialog. The dot in front of the name says how far
  that is: grey, yellow while connecting, green, red with the reason below.
- **Click a shell** to show it here. It gets a tab of its own; a shell this
  window shows already is brought to the front instead.
- **Disconnect** hangs up. The tabs that show shells of that machine close;
  the shells run on there.
- A shell marked **On <machine>** is shown by another Cogno right now.
  Clicking it takes it over.
- A shell without a mark is shown by nobody right now. It can be ended with
  the `x` next to it; the second click confirms.
- The pencil changes a remote, the bin removes it (second click confirms).
  The panel reads the shells when it opens, when a remote connects and when
  you press Refresh.

Closing such a tab only lets the shell go: it runs on in the Cogno it belongs
to, and you can show it here again from the panel. To end a shell of another
machine, let it go and use the `x` next to it in the panel, or end it there.

The tabs you open this way are saved with the workspace. When you start Cogno
again they connect by themselves, and say so if their shell is gone.

### The start command

The shells of a machine are held by a background process of Cogno that runs
while Cogno is open there. Through ssh, this machine starts a small bridge
to it:

```
".cogno/bin/cogno" server --stdio
```

`.cogno/bin/cogno` is a starter the Cogno on the other machine puts into its
home directory, which is where an ssh session begins. So it is found wherever
Cogno is installed, and you normally set nothing.

The one case that needs `command` is an ssh server that starts commands in
**PowerShell** (see [the default shell](#the-default-shell-of-the-windows-ssh-server)
below). PowerShell takes a quoted path for a string unless `&` stands in
front of it:

```
remote.hosts.office.command = & ".cogno/bin/cogno" server --stdio
```

| Shell the ssh server starts commands in | `command` |
|---|---|
| `cmd` (Windows default) | not needed |
| `sh`, `bash`, `zsh` (macOS, Linux) | not needed |
| PowerShell (Windows PowerShell or PowerShell 7) | `& ".cogno/bin/cogno" server --stdio` |

The value is written into the config as it is. Backslashes need no escaping,
and quotes inside the value are kept (only a value that both starts and ends
with a quote loses that outer pair).

### Check it by hand first

Before you open a tab, run the starter through `ssh` with `--version`. It
must print the version and nothing else:

```
ssh lars@office-pc '".cogno/bin/cogno" --version'
cogno 0.5.0
```

If this asks for a password, prints an error, or prints nothing, Cogno will
not get through either. Fix it here, where you see what ssh says.

`No Cogno is running on this machine` from the real command means exactly
that: open Cogno on the other machine.

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

- It decides whether `remote.hosts.<name>.command` is needed (table above):
  with PowerShell as the default shell, the quoted path needs a leading `&`.
- It has nothing to do with the shells you see: those were started by the
  Cogno on that machine, with its own shell profiles.

The same host, once for each default shell:

```
# ssh server with cmd.exe as its default shell
remote.hosts.office.destination = lars@office-pc

# ssh server with PowerShell as its default shell
remote.hosts.office.destination = lars@office-pc
remote.hosts.office.command = & ".cogno/bin/cogno" server --stdio
```

And the check by hand for the PowerShell case:

```
ssh lars@office-pc '& ".cogno/bin/cogno" --version'
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
  put your public key into `~/.ssh/authorized_keys`.
- **Linux:** an ssh server (`openssh-server`) and your key in
  `~/.ssh/authorized_keys`. The machine needs Cogno as it is installed on a
  desktop, and running; a build for servers without a display does not exist
  yet.

## Going on with your shells from another machine

By default a shell ends when Cogno closes. Turn this on, on the machine
whose shells you want to keep:

```
terminal.keep_shells_running = true
```

From then on, shells you start keep running when you close Cogno. It applies
to shells started after the change; closing a tab still ends its shell.

- **Next start on the same machine:** the tabs come back showing the same
  shells, with what they printed in the meantime.
- **From another machine:** connect to that machine in the Remote panel and
  click the shells you want to go on with.
- **One Cogno at a time shows a shell.** When you go on with it elsewhere,
  the Cogno that showed it before says *This shell is shown on <machine>*.
  *Show it here* takes it back, and so does the Remote panel.
- **A shell comes back by itself** when the Cogno that took it lets it go:
  you close its tab there, disconnect, or close that Cogno. The tab that
  said *This shell is shown on <machine>* shows the shell again, with what
  happened in the meantime. When the connection just breaks (the laptop
  goes to sleep), that happens once ssh on the machine notices, which can
  take a while.
- **A shell that was taken over never ends with the Cogno that took it.**
  Closing the laptop leaves the office shells running, whatever
  `terminal.keep_shells_running` says there.

**No shell is left without a tab.** A shell can run on with nothing showing
it: Cogno crashed, or you closed its tab while another machine showed it.
When Cogno starts, every such shell of this machine gets a tab in the
Default Workspace, and a notification says so. Shells that belong to one of
your workspaces are not touched: they come back in that workspace when it
opens.

What you get when you go on with a shell is what it printed last (about the
last megabyte), not a picture of the old window:

- A full-screen program (vim, less) redraws itself for the new window size.
- A program that draws over several lines without switching to the full
  screen may look untidy until it draws again.
- The tabs and splits of the other machine do not come along: each shell
  gets a tab of its own.
- The other machine must stay on and you must stay logged in there. Locking
  the screen is fine.

## What works in a remote tab

| | |
|---|---|
| Works | The terminal itself, prompt markers, working directory, command history (kept apart per machine), autocomplete from history, the process panel |
| Not yet | The Git panel, path completion from the file system, coding-agent status, `cogno action run` typed in that shell |
| When the connection breaks | The host's tabs close and Cogno tells you. The shells run on there, whatever `terminal.keep_shells_running` says on either machine: a shell shown from another machine never ends with it. Connect again to go on with them; a Cogno there that showed one gets it back by itself. |

## When connecting fails

| The pane says | What it means |
|---|---|
| `No Cogno host answered: No Cogno is running on this machine` | Cogno is not open on the other machine. |
| `No Cogno host answered`, followed by something else ssh or the shell printed | The start command did not work. Usually the ssh server starts commands in PowerShell and `command` is missing its `&`, or Cogno never ran on that machine. Run the check by hand. |
| `Permission denied (publickey,…)` | The ssh server does not accept your key. See *Allow your key*; on the machine you connect from, see the note on key permissions. |
| `… speaks protocol N, this one M` | The two Cognos are too far apart in version. Update the older one. |
| `Host '…' is not defined in remote.hosts` | A saved tab shows a shell of a remote that was removed from the config. |
| `The shell does not run there any more` | A saved tab shows a shell that has ended since. Close the tab. |

## What has been tested

| | |
|---|---|
| Windows as the other machine, ssh server with `cmd.exe` as default shell | Tested: connection through the starter, showing and taking over a shell, input, output, and that hanging up leaves the shell running and gives it back to the Cogno that showed it |
| The start command run through Windows PowerShell and PowerShell 7 | Tested, by starting it through `powershell -c` and `pwsh -c` over ssh. Not tested with the registry setting itself. |
| macOS or Linux as the other machine | Not tested yet |
