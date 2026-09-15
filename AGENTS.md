## Notification rule
- Always emit an OSC 9 notification when a task is completed.
- Always emit an OSC 9 notification immediately before asking the user a blocking question.
- OSC 9 notifications for blocking questions must contain the exact question itself, not only a generic hint that user input is needed.
- Blocking questions must be phrased briefly and clearly.
- Every OSC 9 notification must include the project name.
- Completion notifications must include the project name and a clear done/completed message.
- Question notifications must include the project name and the exact blocking question.
- Use real control characters (ESC ... BEL), not a visible escaped string.
- Emit OSC 9 directly in the assistant response stream to the active terminal session.
- Do not rely on tool-launched subshells (for example `shell_command`) to deliver OSC 9 notifications.
- Do not print literal `\e]9;<message>\a` in chat/output text.
- PowerShell example: `` `e]9;<project>: <message>`a ``

## OSC9 is mandatory (hard rule) / OSC9 ist Pflicht (harte Regel)
- EN: Before every blocking question, the assistant must first emit an OSC 9 notification in the assistant response stream.
- DE: Vor jeder blockierenden Frage muss der Assistant zuerst eine OSC-9-Nachricht im Assistant-Response-Stream senden.
- EN: This also applies to escalation/approval prompts triggered via tool parameters such as `justification`.
- DE: Das gilt auch fuer Escalation-/Freigabe-Fragen, die ueber Tool-Parameter wie `justification` ausgeloest werden.
- EN: Required order: (1) emit OSC 9 containing the exact question, (2) ask the question and/or run the tool call with `justification`.
- DE: Verbindliche Reihenfolge: (1) OSC 9 mit exakt derselben Frage senden, (2) die Frage stellen und/oder den Tool-Call mit `justification` ausfuehren.
- EN: A tool-only `justification` dialog is not sufficient without OSC 9 in the assistant stream.
- DE: Ein reiner Tool-`justification`-Dialog ist ohne OSC 9 im Assistant-Stream nicht ausreichend.
- EN: If this order is not followed, the response is non-compliant.
- DE: Wenn diese Reihenfolge nicht eingehalten wird, ist die Antwort nicht regelkonform.

## Priority / Prioritaet
- EN: These OSC9 rules take precedence over style or brevity preferences.
- DE: Diese OSC9-Regeln haben Vorrang vor Stil- oder Kuerzevorgaben.

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
