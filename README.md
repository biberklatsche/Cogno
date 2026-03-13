# Cogno 2

Terminal work, without terminal chaos.

Cogno is a terminal workspace built for heavy daily shell use:

- autocomplete for 1000+ CLI commands
- multiple tabs and split panes
- workspaces for recurring setups
- editor-like input behavior
- command palette and terminal search
- simple configuration
- process information for active shells and commands
- ...and more!

Built with Tauri, Angular, and Rust.

## CLI

Cogno also exposes a local CLI.

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

## Configuration

Cogno ships with bundled defaults and keeps user overrides small.

That keeps the user config readable while still exposing the full settings surface through:

```bash
cogno config show --defaults
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
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:desktop
```

### Repository Layout

Main areas:

- `src/app`
  app entry, startup, and application wiring
- `src/packages/app`
  main application implementation, terminal UI, menus, config, notifications
- `src/packages/assets`
  shared styles, icons, fonts, and static assets
- `src/packages/features`
  feature packages such as workspaces, notifications, autocomplete, and search
- `src/packages/core-sdk`
  public contracts, shared models, and extension interfaces
- `src/packages/core-host`
  host infrastructure and feature registry
- `src/packages/core-ui`
  shared UI building blocks
- `src-tauri`
  native desktop wrapper and Rust-side commands
