![Cogno terminal workspace](./cogno.jpg)

# Cogno

The terminal, without the extra work.

Cogno is a terminal for modern developers. It remembers commands,
keeps projects organized, and gives you familiar shortcuts out of the box.
Less mental load. More doing.

Cogno is local-first, open source, and built to stay close to the way you
already work. It runs on Windows, Linux, and macOS with PowerShell, Bash, and
Zsh.

## Highlights

- Context-aware command suggestions based on command history, current
  directory, and project context
- 1000+ CLI integrations, powered entirely on-device
- Editor-like input behavior with familiar shortcuts for cursor movement,
  selection, and replacement
- In-terminal AI that works with local model runners such as Ollama and LM
  Studio, or any OpenAI-compatible API
- Reusable workspaces with saved tabs, panes, and project layouts
- Notifications for long-running commands, including OSC 9 support
- Search and filtering for the current command output or the full terminal
  buffer
- Fast command palette for actions
- Windows, Linux, and macOS support
- PowerShell, Bash, and Zsh support
- Process information for active shells and commands
- CLI access for automation and scripting
- Single self-contained binary, typically under 40 MB

## Why Cogno?

Terminal work is where development, debugging, deployment, and automation
happen, but the experience often comes with unnecessary repetition: hunting for
old commands, rebuilding pane layouts, scrolling through noisy output, or
switching tools for input and AI help.

Cogno keeps the speed and flexibility of the shell, then adds the structure
that recurring work benefits from: command memory, workspace persistence,
editor-like input, focused search, and local-first AI directly in the terminal.

The project is actively shaped as a community-friendly terminal workspace.
Feedback, issue reports, ideas, and focused contributions are welcome.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, checks, and contribution
guidelines. Please also read the [Code of Conduct](./CODE_OF_CONDUCT.md)
before joining project spaces.

## Community

- Website: [cogno.rocks](https://cogno.rocks)
- Discord: [Join the Cogno Discord](https://discord.gg/hNk9zzzRnU)
- Reddit: [r/cogno](https://www.reddit.com/r/cogno/)
- YouTube: [Cogno on YouTube](https://www.youtube.com/channel/UCPzQB0-9aaBQj1glWJIG6xw)

## Quick Start

```bash
pnpm install
pnpm dev
```

For the desktop application, make sure the platform-specific Tauri
prerequisites are installed as well.

## License

The project source code in this repository is licensed under `MPL-2.0`,
except for `src/packages/features`, which is licensed under `MIT`, unless a
file or directory contains a different third-party license notice.

## Configuration

Cogno ships with bundled defaults and keeps user overrides small.

That keeps the user config readable while still exposing the full settings surface through:

```bash
cogno config show --defaults
```

User files live in the Cogno home directory:

- `~/.cogno`
- in development builds: `~/.cogno-dev`

There you will find:

- the user settings
- generated shell integration scripts under `shell-integration/`
- database file `cogno.db`

## CLI

```bash
cogno [--config <path>] [--set key=value ...]
  run
  action
    list
    run <name> [args...]
  config
    show [--defaults]
    get <key>
    path
```

Examples:

```bash
cogno --help
cogno config show --defaults
cogno config get shell.default
cogno action list
cogno action run open_config
```

## Development

### Prerequisites

- Node.js
- `pnpm`
- Rust toolchain
- Tauri prerequisites for your platform

### Install

```bash
pnpm install
```

### Run

```bash
pnpm dev
```

### Useful Commands

```bash
pnpm lint          # run code and architecture linting
pnpm typecheck     # run the TypeScript compiler without emitting files
pnpm test          # run the automated test suite
pnpm build         # build the web application for production
pnpm build:desktop # build the desktop application bundle
```

### Repository Layout

Main areas:

- `src/app`
  Angular entry point: configures DI and registers the product
- `src/packages/__test__`
  shared test helpers, fixtures, and mocks
- `src/packages/app`
  platform contract implementations, Angular adapters, terminal UI, and runtime wiring
- `src/packages/app-tauri`
  Tauri adapters for desktop integration; proxies AI provider HTTP requests to the backend
- `src/packages/assets`
  shared styles, icons, fonts, and static assets
- `src/packages/core-api`
  stable platform contracts: abstract classes and interfaces consumed by all layers
- `src/packages/core-domain`
  framework-independent domain logic and use cases
- `src/packages/core-support`
  small, pure, low-dependency utilities
- `src/packages/core-ui`
  generic UI building blocks with no feature or app semantics
- `src/packages/features`
  complete feature logic: AI chat, workspaces, notifications, autocomplete, shell support, and search
- `src/products`
  composition layer: binds features, app, and Angular providers for a specific product
- `src-tauri`
  native desktop wrapper and Rust-side commands
