# Contributing to Cogno

Thanks for taking the time to improve Cogno. Focused bug reports, small pull
requests, documentation fixes, and well-scoped feature ideas are welcome.

## Getting Started

### Prerequisites

- Node.js
- `pnpm`
- Rust toolchain
- Tauri prerequisites for your platform

### Setup

```bash
pnpm install
pnpm dev
```

For web-only development, you can also run:

```bash
pnpm dev:web
```

## Before Opening a Pull Request

Please run the relevant checks before submitting changes:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

For a full local verification pass, run:

```bash
pnpm check
```

## Code Style

- Keep changes focused and avoid unrelated refactoring.
- Use clear, descriptive names for variables, functions, classes, and files.
- Prefer strict TypeScript types. Do not use `any`; use `unknown` when a value
  is not known at compile time.
- Follow the existing Angular, Tauri, and package structure in the repository.
- Add or update tests when behavior changes.

## Reporting Issues

When reporting a bug, include:

- The Cogno version or commit you used
- Your operating system
- Steps to reproduce the issue
- What you expected to happen
- What actually happened
- Relevant logs, screenshots, or terminal output if available

## Feature Ideas

Feature requests are easiest to discuss when they describe the workflow behind
the request. Please include the problem you are trying to solve, not only the
proposed interface or implementation.

## Licensing

By contributing, you agree that your contribution will be licensed under the
same license terms as the files you modify. Most of the repository is licensed
under `MPL-2.0`; `src/packages/features` is licensed under `MIT` unless a file
or directory contains a different third-party license notice.
