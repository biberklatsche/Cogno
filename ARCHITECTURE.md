# Architecture

## Dependency direction

```
app -> core-api <- features
```

The bootstrap layer (`src/app/`) may import from both.

## Layers

| Layer | Responsibility |
|---|---|
| **core-api** | Stable platform contracts (abstract classes, interfaces) |
| **core-domain** | Larger domain logic with no framework dependencies |
| **core-ui** | Generic UI building blocks (no feature or app semantics) |
| **core-support** | Small, pure, low-dependency utilities |
| **features** | Complete feature logic: state, services, orchestration, feature UI |
| **app** | Implements platform contracts, wires features into the runtime |
| **products** | Composition layer: binds features, app, and Angular components |
| **Bootstrap** (`src/app/`) | Entry point: configures Angular DI, registers the product |

## Rules

### core-api
- Contains only stable, general-purpose platform contracts.
- No feature names, workflow APIs, UI orchestration, or product semantics.
- No aggregations or default values for specific features.

### app
- Implements the general platform contracts from `core-api` only.
- Has no feature-domain knowledge — only adapters and runtime access.

### features
- Contains complete feature logic: state, orchestration, parsing, services, and feature UI.
- Registers capabilities through neutral contributions only (see Contribution model).
- May depend on `core-api` and `core-ui`, never on `app`.

### core-ui
- Contains only generic UI building blocks (buttons, inputs, icons, layouts).
- No feature or app semantics.

### core-support
- Contains small, pure, low-dependency utilities.
- No Angular, app, or feature dependencies.

### core-domain
- Contains larger domain logic.
- No app, feature, or UI dependencies.

## Contribution model

Adding a new feature should ideally change exactly three things:

1. The feature itself (`src/packages/features/`)
2. Its neutral contributions in `featureApplicationFeatureCollection`
3. The product composition (`src/products/`)

### `featureApplicationFeatureCollection`

Every feature self-registers in `features/feature-application-feature.collection.ts`:

| Contribution slot | Purpose |
|---|---|
| `databaseMigrations` | Schema migrations executed on app startup |
| `shellDefinitions` | Supported shell types (Bash, ZSH, PowerShell …) |
| `shellPathAdapterDefinitions` | Platform-specific path adapters per shell |
| `shellSupportDefinitions` | Additional shell capabilities |
| `sideMenuFeatureDefinitions` | Side-menu entries with icon, action name, and lifecycle |
| `settingsExtensions` | Zod schema extensions and default values for the config reader |
| `terminalAutocompleteSuggestorDefinitions` | Autocomplete suggestors for the terminal |
| `notificationChannels` | Additional notification channels (e.g. OS notifications) |

### Side-menu features

Side-menu entries are registered via a `SideMenuFeatureDefinition`:

```
createLifecycle(injector, handle) → SideMenuFeatureLifecycleContract
```

`createLifecycle` receives the Angular injector (for DI) and a handle to open, close, or focus the panel. The resulting `SideMenuFeatureLifecycleContract` reacts to `onOpen`, `onClose`, `onFocus`, `onBlur`, and `onModeChange`.

## Ports vs. adapters

### Port (feature owns the DI token)

A feature that needs an external capability defines its own abstract port:

```
features/side-menu/workspace/workspace-close-guard.port.ts
  → abstract class WorkspaceCloseGuard  (DI token, owned by the feature)
  → implements WorkspaceCloseGuardContract  (interface from core-api)
```

The app implements the interface without knowing the token:
```
app/app-host/workspace-close-guard.adapter.service.ts
  → implements WorkspaceCloseGuardContract
```

Bootstrap wires them together:
```typescript
{ provide: WorkspaceCloseGuard, useExisting: WorkspaceCloseGuardAdapterService }
```

Use ports when only one feature needs the token.

### Adapter (app implements a platform contract)

For shared platform capabilities (filesystem, HTTP, workspace, terminal), `core-api` defines the abstract contract. The app implements it; features inject it:

```
core-api: abstract class WorkspaceHostPort    ← features inject this
app:      WorkspaceHostPortAdapterService implements WorkspaceHostPortContract
Bootstrap: { provide: WorkspaceHostPort, useExisting: WorkspaceHostPortAdapterService }
```

Use adapters for capabilities shared across many features.

## Actions

Features can react to dispatched actions without importing from `app`:

```typescript
constructor(private readonly actionDispatcher: ActionDispatcher) {
  this.actionDispatcher.onAction$("select_workspace_1")
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => { /* handle */ });
}
```

`onAction$` returns an `Observable<void>`. Marking the action as "performed" (prevents browser-native key handling) is handled transparently by the adapter.

## Code hygiene

Community source code must contain no hints about future extensions — no names, comments, branches, or placeholders for variants that do not yet exist.
