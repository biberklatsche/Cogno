# Cogno

Terminal work, without terminal chaos.

Cogno is a terminal workspace built for heavy daily shell use:

- autocomplete for 1000+ CLI commands
- multiple tabs and split panes
- workspaces for recurring setups
- editor-like input behavior
- command palette and terminal search
- process information for active shells and commands
- CLI
- ...and more!

## License

The project source code in this repository is licensed under `MPL-2.0`,
except for `src/packages/features`, which is licensed under `MIT`, unless a
file or directory contains a different third-party license notice.

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
  app entry, startup, and application wiring
- `src/packages/__test__`
  shared test helpers, fixtures, and mocks
- `src/packages/app`
  main application implementation, terminal UI, menus, config, notifications
- `src/packages/app-tauri`
  Tauri-facing adapters for desktop integration
- `src/packages/assets`
  shared styles, icons, fonts, and static assets
- `src/packages/core-api`
  public application contracts and extension interfaces
- `src/packages/core-domain`
  framework-independent domain logic and use cases
- `src/packages/core-host`
  host infrastructure and feature registry
- `src/packages/core-support`
  shared framework-independent support utilities
- `src/packages/core-ui`
  shared UI building blocks
- `src/packages/features`
  feature packages such as workspaces, notifications, autocomplete, and search
- `src/products`
  product composition and application-specific feature wiring
- `src-tauri`
  native desktop wrapper and Rust-side commands
