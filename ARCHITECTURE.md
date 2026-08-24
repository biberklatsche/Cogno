# Architecture

Cogno is one product in one repository. The architecture exists for two
reasons only: so that a change stays local, and so that a piece of logic can
be tested without booting the whole application. Everything that does not
serve one of those two goals is not part of it.

## Packages

```
src/
  app/          the application: shell, wiring, everything product-specific
  features/     self-contained capabilities plugged into the app
  platform/     the only code that talks to Tauri
  shared/       code with no knowledge of the application
```

| Package | Contains | May import |
|---|---|---|
| `shared` | domain models and logic, generic UI building blocks, small utilities, and the few ports that more than one feature needs | nothing internal |
| `platform` | Tauri bindings as injectable services: database, filesystem, pty, http, clipboard, opener, os, window, logger | `shared` |
| `features` | one folder per feature: state, services, UI, migrations, settings schema, and the ports it needs from the app | `shared`, `platform`, other features through their `index.ts` |
| `app` | terminal, tabs, grid, window, menus, config, notifications, bootstrap, and the implementations of every port | everything |

The dependency direction is a straight line:

```
app  →  features  →  platform  →  shared
```

Nothing imports `app`. Only `platform` imports `@tauri-apps/*`. These two
sentences are the architecture; the rest of this document explains how to
work inside them.

## Rules

Enforced by `.dependency-cruiser.cjs`; `pnpm lint:architecture` fails on a
violation.

1. Only `platform` imports `@tauri-apps/*`.
2. `shared` imports no other internal package. `shared/domain` imports no
   framework (no Angular, no RxJS).
3. `platform` imports only `shared`.
4. `features` never import `app`. A feature imports another feature only
   through that feature's `index.ts`.
5. Nothing outside `app` imports `app`.
6. Only the four `@cogno/*` aliases exist.

## Ports

A feature that needs something from the application declares an abstract
class next to the code that needs it and injects it. The app implements it
and the bootstrap binds the two:

```
features/workspace/workspace-close-guard.port.ts
  export abstract class WorkspaceCloseGuard { abstract confirmClose(...): Promise<boolean>; }

app/adapters/workspace-close-guard.adapter.ts
  export class WorkspaceCloseGuardAdapter implements WorkspaceCloseGuard { ... }

app/app.config.ts
  { provide: WorkspaceCloseGuard, useExisting: WorkspaceCloseGuardAdapter }
```

The port belongs to the feature: it describes what the feature needs, in the
feature's words. Only when two or more features need the same port does it
move to `shared/ports`. There is no third place.

Platform services need no port. `platform` exports concrete injectable
classes (`Database`, `Filesystem`, `CommandRunner`, …); tests replace them
with `vi.mock` or a stub provider. The Tauri boundary is the package, not an
interface.

## Features

A feature is a folder under `features/` that owns everything about one
capability and exposes one `index.ts` with a `FeatureDefinition`:

```ts
export const workspaceFeature: FeatureDefinition = {
  id: "workspace",
  migrations: [...],          // schema steps, applied on startup
  sideMenu: [...],            // side-menu entries with icon, action, lifecycle
  settings: workspaceSettings, // zod schema extension + defaults
};
```

`FeatureDefinition` lives in `shared` and has one optional field per
extension point the app offers (migrations, side-menu entries, settings,
autocomplete suggestors, shells, notification channels). Adding a feature
means adding its folder and one line in `app/features.ts`. Adding an
extension point means adding one optional field and one consumer in `app`.

Features talk to each other through their `index.ts` or not at all. A
feature that needs another feature's state imports its public service; a
feature that needs to react to something the app does uses an action:

```ts
constructor(private readonly actions: ActionDispatcher) {
  this.actions.onAction$("select_workspace_1")
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => { ... });
}
```

`ActionDispatcher` is a `shared/ports` port because every feature uses it.

## The app

`app` is where the product lives. It is allowed to know every feature by
name: the feature list, the port implementations, the wiring. It contains the
terminal itself — pty, renderer, input handling — because the terminal is the
product, not a feature of it. Anything that plugs *into* the terminal
(history, autocomplete, the composer) is a feature.

Bootstrap (`app/main.ts`, `app/app.config.ts`) is the only place `inject()`
is used; everywhere else constructor injection keeps tests plain.

## Testing

- `shared/domain`: plain unit tests, no framework.
- `features`: unit tests with stubbed ports and mocked platform modules.
- `platform`: Rust-side tests for the database; the TypeScript side is a
  thin `invoke` layer and is not unit-tested.
- `app`: component and wiring tests where behaviour warrants them.

## Migration status

The code is being moved toward this layout in steps. Each step is one
commit, the app runs after each, and this table is updated with it. Until a
row is done, the old rule for that area still applies.

| Step | What | Status |
|---|---|---|
| 1 | Remove `products/` and `ApplicationProduct`; fold composition into the bootstrap; drop the generic type parameters on the feature registry | open |
| 2 | Merge `core-support`, `core-domain`, `core-ui` into `shared` | open |
| 3 | Rename `app-tauri` to `platform`; collapse each platform contract + host adapter pair into one injectable service | open |
| 4 | Move the remaining `core-api` contracts to feature-owned ports or `shared/ports`; delete `core-api` | open |
| 5 | Move history, autocomplete and composer out of `app/terminal` into `features` | open |
| 6 | Fold `src/app` into `app`; replace the registry classes with `FeatureDefinition` and a plain list; rewrite `.dependency-cruiser.cjs` to the six rules above | open |
