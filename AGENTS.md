## Angular DI rule
- `inject()` is allowed in `src/bootstrap/app.config.ts`.
- In all other files, do not use `inject()`.
- Use constructor injection everywhere else to keep Vitest testing simple.

## Architecture rule
- Keep the architecture clean. This is the top priority.
- `ARCHITECTURE.md` is the single source of truth. Layers and allowed imports:
  `shared/` and `platform/` (foundation, no product knowledge), `core/` with
  `infrastructure/`, `terminal/`, `command-log/`, `session/`, `workbench/`, `api/`
  (the product, always on), `features/` (the product, switchable), `bootstrap/`
  (composition root). Only `platform` imports Tauri. Features import `shared`,
  `platform` and `core/api` — nothing else. The full import matrix is in
  `ARCHITECTURE.md` section 2.1 and enforced by `pnpm lint:architecture`.
- Aliases: `@cogno/shared`, `@cogno/platform`, `@cogno/core`, `@cogno/features`,
  `@cogno/bootstrap`.
- Do not change the architecture on your own. If implementation reveals a
  contradiction or a gap, stop and ask; never decide by assumption.
- Build nothing on spec: no field, state, hook or abstraction without a consumer
  in the change at hand. Keep it as simple as it has to be right now.
