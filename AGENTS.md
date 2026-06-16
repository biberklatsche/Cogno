## Angular DI rule
- `inject()` is allowed in `src/app/app.config.ts`.
- In all other files, do not use `inject()`.
- Use constructor injection everywhere else to keep Vitest testing simple.

## Architecture rule
- Keep the architecture clean. This is the top priority.
- The intended dependency direction is: `app -> core-api <- features`.
- `core-api` must only contain general, reusable contracts/capabilities. It must not define feature-specific workflows, feature-specific host ports, or UI-specific orchestration APIs.
- `features` may depend on `core-api` and `core-ui`, but must not depend on `app`.
- `app` implements the contracts from `core-api` and wires features to the concrete runtime.
- `app-host` may contain adapters and composition for concrete features, but those adapters must implement general `core-api` contracts instead of pushing feature-specific APIs into `core-api`.
- Do not add feature-specific host-port contracts such as feature-owned chat/search/workspace orchestration ports to `core-api`.
- Do not put UI actions such as opening dialogs, opening menus, or other concrete app interactions into `core-api` contracts. Model general capabilities instead.
- If a contract is primarily needed by one feature and expresses that feature's workflow rather than a general app capability, keep it out of `core-api`.
