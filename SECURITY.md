# Security Policy

Security reports are appreciated. Cogno is a terminal application, so issues
that affect command execution, local files, shell integration, configuration,
or desktop integration are especially important.

## Supported Versions

Cogno is currently in early development. Security fixes are handled on the
default branch first.

| Version | Supported |
| ------- | --------- |
| Default branch | Yes |
| Older releases | Best effort |

## Reporting a Vulnerability

Please do not open a public issue for a suspected security vulnerability.

Use GitHub's private vulnerability reporting feature if it is enabled for this
repository. If private reporting is not available, contact the maintainer
privately before publishing details.

When reporting a vulnerability, include:

- A clear description of the issue
- Steps to reproduce it
- The operating system and Cogno version or commit you tested
- Any relevant logs, screenshots, terminal output, or proof of concept
- Whether the issue requires local access, user interaction, or a specific
  configuration

## Disclosure

Please give the maintainer reasonable time to investigate and prepare a fix
before sharing details publicly. Coordinated disclosure helps protect users
while still making the issue visible once a fix or mitigation is available.

## Scope

Security-relevant areas include:

- Shell command execution and process handling
- Shell integration scripts
- Configuration files and local data storage
- Workspace handling
- Terminal escape sequence handling
- Desktop integration through Tauri plugins

Issues outside this scope may still be valid, but they may be handled as
regular bugs if they do not create a security impact.
