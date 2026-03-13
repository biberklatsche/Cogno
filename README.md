# Cogno

Terminal work, without terminal chaos.

## What Cogno Is

Cogno is a terminal workspace built for heavy daily shell use:

- autocomplete for 1000+ CLI commands
- multiple tabs and split panes
- editor-like input behavior
- command palette and terminal search
- simple configuration
- and more...

The goal is simple: make terminal work feel organized instead of noisy.

## Current Features

- multiple tabs with custom titles and colors
- split panes with drag-and-drop rearranging
- saved workspaces
- command palette
- terminal search with highlights
- shell integration for supported shells
- smart history and autocomplete
- editor-like input behavior
- process information for active shells
- configurable shortcuts
- drag and drop for file paths, tabs, and panes
- local CLI for config and actions
- OS and in-app OSC 9 notifications
- OSC 9 progress / loading bar support

## Why It Exists

Heavy terminal use becomes messy fast.

Once you work across several repositories, long-running processes, repeated commands, and multiple shells at once, a plain terminal window stops feeling like enough.

Cogno focuses on flow: keeping terminal work organized without getting in the way.

## Quick Start

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
###Build
```bash
pnpm build
pnpm build:desktop
```
## CLI

Cogno exposes a local CLI for inspecting config and triggering actions.

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

## Supported Shells

Cogno currently supports workflows around:

- Bash
- Zsh
- PowerShell
- Git Bash

Shell integration and shell-aware features continue to evolve over time.

## Development

Main areas:

- src/app
- src/packages/features
- src/packages/core-sdk
- src/packages/core-host
- src/packages/core-ui
- src-tauri

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:desktop
```

## Status

Cogno is under active development and already usable, but parts of the architecture and feature set are still evolving.

The current direction is straightforward:

- keep the terminal fast
- keep the workspace clear
- keep the architecture clean enough to grow
- keep the shell integration practical and robust
- expand terminal protocol support over time

## Open Source

Cogno is open source and built in the open.

The goal is to make the core terminal genuinely useful for daily work, grow it with community feedback, and keep the foundation strong as the project evolves.

## Origin

Cogno is the successor to the original Electron-based Cogno project:

[Original Cogno project](https://gitlab.com/cogno-rockers/cogno)
