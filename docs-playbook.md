# Cogno Docs Playbook

Instructions for an agent generating the Cogno website documentation. The agent
reads this file, reads the listed source files, and writes the output markdown.

**Command:**
> "Read `docs-playbook.md` and generate the documentation."

Run it from the Cogno project root. Output files are overwritten on each run.
Only use information found in the sources — never invent settings or defaults.

---

## The one rule: the references are generated, not written

The two reference pages of the website come straight from the code. **Never write
or edit them by hand, and never copy their content into a prose page:**

| Website page | Produced by | Contains |
|---|---|---|
| `config/settings.md` ("All settings") | `scripts/generate-config-docs.ts` (Zod schemas + `default-config-values.ts`) | every setting as its own heading: description, type, default |
| `config/actions.md` ("All actions") | `scripts/generate-actions.ts` (core action catalog + feature definitions) | every action, grouped: description, default keybindings |

```bash
pnpm generate:site-docs   # writes both pages into ../meetcogno, plus docs/*.md here
```

The same content lands in `docs/config.md` and `docs/actions.md` in this repo;
`pnpm lint` fails when those are stale.

If a setting or action looks wrong, fix the `.describe()` / catalog entry in the
code and regenerate. Section order and action groups are defined at the top of
the two scripts.

Everything else in this playbook is **prose**: concepts, walkthroughs, examples.
That is what the agent actually writes. Prose pages explain and link to the
reference (`/docs/config/settings#font`, one anchor per section and per setting,
e.g. `#fontsize`); they do not repeat its tables.

---

## How to update this playbook

- New setting → add `.describe()` in its Zod schema, run `pnpm generate:site-docs`.
  Nothing to do here.
- New action → it comes from the catalog or the feature definition automatically.
- New feature → add a page section below, add it to the sidebar, list its sources.

---

## Output format

Starlight-compatible Markdown with frontmatter:

```markdown
---
title: Page Title
description: Short one-sentence description.
slug: docs/page-name
---
```

The pages live in `src/content/docs/` (configuration pages in `config/`); the
`slug` sets the URL and must match the sidebar entry (e.g. `config.md` →
`slug: docs/config`, `config/prompt.md` → `slug: docs/config/prompt`).

`getting-started.md`, `logging.md` and `index.md` are maintained by hand and not
generated. When a page is added or removed, update the link lists in
`index.md` and at the end of `getting-started.md` as well.

- **Language:** English
- `##` for top-level sections, `###` for sub-sections
- Setting and action names in backticks, e.g. `font.size`, `open_git`
- US spelling (`color`); hex colors without `#`, e.g. `0e1925`
- Code examples: `text` for config snippets, `bash` for shell commands
- Keep prose short — tables and examples carry the weight
- Write for someone who wants to get something done: lead with the task, show an
  example early, explain exceptions after it. Verify every claim in the code and
  check that example key combos do not collide with a default keybinding
- Examples use `Ctrl+…`; mention the macOS `Command+…` variant once per page

---

## Feature page template

Every feature page has the same shape, so a reader finds the same thing in the
same place:

1. **Two or three sentences:** what the feature does *for the user*.
2. **How to open it:** the default key for Windows/Linux and macOS, right at the top.
3. **"Use it":** task-oriented sections. Keys in one table. Describe what the user
   sees and does — no debounce times, timeouts or class names.
4. **Examples:** a config snippet for the one or two settings people really change.
5. **"Settings":** a short list that links to the entries in the generated
   reference, one anchor per setting (`font.size` → `/docs/config/settings#fontsize`:
   lower-case, dots removed). Do not repeat `mode` / `order` tables or the
   reference's descriptions; no separate "Action" table — name the action in the
   sentence about rebinding.

---

## Pages to generate

### Page 1 — Configuration (four prose pages)

The reference is generated (see above). These pages explain how to use it.

**1a. Overview — write to:** `../meetcogno/src/content/docs/config.md`

**Sources:** `src/core/infrastructure/config/config.mapper.ts` (parser, merge,
diagnostics), `src/core/infrastructure/config/config.service.ts` (watching,
reload), `src/core/workbench/config-bootstrap/config-bootstrap.adapter.ts`
(notifications), `README.md` (CLI).

**Required sections:** where the file lives; syntax (comments only at line start,
no inline comments, last line wins, `keybind` is additive); value kinds (boolean,
number, text and quoting, color, list); how changes apply (live reload, which
settings need a new terminal or a restart); what happens on mistakes (invalid
value, unknown key at top level vs. nested, unknown action); `--config` / `--set`.

**1b. Shell profiles — write to:** `.../docs/config/shell-profiles.md`

**Sources:** `src/core/infrastructure/config/models/shell-config.ts`,
`src/core/session/shells/` (detection, default args), `src-tauri/src/commands/shells.rs`,
`src-tauri/src/commands/shell_spawner.rs` (effective defaults), `getOrderedShellProfiles`
in `config.service.ts`.

**Required sections:** profiles are auto-created on first launch (which shells per
OS); anatomy of a profile with required/optional settings and effective defaults;
`shell.default` / `shell.order` / limit of 9; `open_shell_1…9` and `new_tab:<profile>`;
one complete example. Only document settings the spawner actually reads.

**1c. Prompt — write to:** `.../docs/config/prompt.md`

**Sources:** `src/core/infrastructure/config/models/prompt-config.ts`,
`src/core/session/decoration/prompt-renderer.ts` (fields, `when`, `format`, colors),
the `prompt` block in `default-config-values.ts` (built-in segments).

**Required sections:** segments and profiles; the default prompt and the predefined
segments; fields; `format`; `when` (grammar, behaviour while the field is empty);
style settings; one complete example. Needs shell integration; applies to new
terminals. Only document colors and settings the renderer actually honours.

**1d. Keybindings — write to:** `.../docs/config/keybindings.md`

**Sources:** `src/core/infrastructure/config/models/keybind-config.ts` (grammar),
`src/core/infrastructure/keybindings/modifier.ts` (modifier aliases), the keyboard
layout tables under `src/core/infrastructure/keybindings/keyboard/` (key names),
`src/core/workbench/keybindings/keybind.matcher.ts` (one key per action, later line
wins), `keybind.service.ts` (triggers).

**Required sections:** change or add a key (conflict rules, no unbind); modifiers
and key names (case-sensitive keys); sequences with `>`; action arguments
(`new_tab:<profile>`); triggers `always` / `performable` / `unconsumed` described
by their effect; examples.

### Page 2 — CLI

**Write to:** `../meetcogno/src/content/docs/cli.md`

**Source:** `README.md` (CLI synopsis).

**Required sections:** launch flags `--config <path>`, `--set key=value`;
`cogno config` (`show`, `show --defaults`, `get <key>`, `path`); `cogno action`
(`list`, `run <name> [args...]`). One example per command.

### Page 3 — Actions

Generated — see "The one rule". Nothing to write. The intro text of the page lives
in `renderSitePage()` in `scripts/generate-actions.ts`.

### Page 4 — Autocomplete

**Write to:** `../meetcogno/src/content/docs/autocomplete.md`

**Sources:**
- `src/core/session/autocomplete/terminal-autocomplete.service.ts` — constants (max suggestions, visible items, debounce, filter modes)
- `src/core/session/autocomplete/suggestors/history-command.suggestor.ts`
- `src/core/session/autocomplete/suggestors/command-pattern.suggestor.ts`
- `src/core/session/autocomplete/suggestors/history-directory.suggestor.ts`
- `src/features/autocomplete/` — the spec-command suggestor (1000+ CLI tools)
- `src/core/session/recorder/command-recorder.ts` — which commands are recorded into the history (return-code whitelist)

**Required sections:** how suggestions appear; the suggestion sources (history
commands, history patterns, history directories, spec commands); filter modes and
how `cycle_tab` cycles them; keyboard handling; what gets into the history
(`terminal.history.allowed_return_codes*`). Settings: link to the generated
`autocomplete.*` and `terminal.history.*` rows.

### Page 5 — Notifications

**Write to:** `../meetcogno/src/content/docs/notifications.md`

**Sources:**
- `src/features/notification-overview/notification-center-state.service.ts`
- `src/features/notification-overview/notification-side-menu.lifecycle.ts`
- `src/features/notification-overview/notification.feature-definition.ts`

**Required sections:** event types (long-running commands, handled and unhandled
exceptions, OSC 9 messages); the unread badge; delivery channels (in-app toast,
OS notification). Settings: the generated `notification.*`,
`terminal.notifications.*` and `feature.notification_overview.*` rows.
Action: `open_notification`.

### Page 6 — Command Palette

**Write to:** `../meetcogno/src/content/docs/command-palette.md`

**Sources:**
- `src/features/command-palette/command-palette.service.ts`
- `src/features/command-palette/command-palette.feature-definition.ts`

**Required sections:** what it shows (all registered actions with keybindings,
filterable, keyboard-navigable, rebuilt when the config changes); keyboard
handling. Setting: `feature.command_palette.mode`. Action: `open_command_palette`.

### Page 7 — Search

**Write to:** `../meetcogno/src/content/docs/search.md`

**Sources:**
- `src/features/terminal-search/terminal-search.service.ts`
- `src/features/terminal-search/terminal-search.feature-definition.ts`

**Required sections:** searches the active terminal's scrollback; debounce;
results show the matching line with the match highlighted, selecting one scrolls
the terminal; pagination;
options (case-sensitive, regex, block search); keyboard handling. Settings: the
generated `terminal.decoration.*` (match colours) and `feature.search.*` rows.
Action: `open_terminal_search`.

### Page 8 — Git

**Write to:** `../meetcogno/src/content/docs/git.md`

**Sources:**
- `src/features/git/git-status.service.ts`
- `src/features/git/git-diff.service.ts`
- `src/features/git/git.feature-definition.ts`

**Required sections:** the panel follows the focused terminal's working directory
and shows the repository status; the diff view; that it runs `git` in that
directory, so it is unavailable in remote (SSH) sessions. Setting:
`feature.git.mode` (off by default). Action: `open_git`.

### Page 9 — Process Info

**Write to:** `../meetcogno/src/content/docs/process-info.md`

**Sources:**
- `src/features/process-info/process-info.service.ts`
- `src/features/process-info/process-info.feature-definition.ts`

**Required sections:** shows the process tree of the focused session and polls
while the panel is open; the lock toggle that freezes the panel on one session
instead of following focus; the unbound/closing/closed states. Setting:
`feature.process_info.mode`. Action: `open_process_info`.

### Page 10 — Coding Agents

**Write to:** `../meetcogno/src/content/docs/coding-agents.md`

**Sources:**
- `src/features/coding-agent/coding-agent-status.service.ts`
- `src/features/coding-agent/coding-agent-provider-registry.service.ts`
- `src/features/coding-agent/providers/` — one directory per supported agent
- `src/features/coding-agent/coding-agents.feature-definition.ts`

**Required sections:** Cogno detects coding agents running in a terminal and
shows their state (working, question, ready, error) in the tab and the side
panel; which agents are supported (read the providers directory — do not
hard-code the list); notifications per state. Hooks: Cogno sees an agent's
state through a hook it writes into the agent's own config; on the first scan
Cogno offers to install it once per agent, and the "Detected" list in the panel
lets the user install (plus) or remove (trash, then confirm with the check
mark) the hook at any time. A removed hook is not offered again. Settings: the
generated `feature.coding_agents.*` rows. Action: `open_coding_agents`.

### Page 11 — Workspaces

**Write to:** `../meetcogno/src/content/docs/workspaces.md`

**Sources:**
- `src/core/workbench/workspace/workspace-side.component.ts` — the panel: tiles, buttons, tooltips
- `src/core/workbench/workspace/workspace-host-application.service.ts` — create, close, delete, auto-save, dirty state
- `src/core/workbench/workspace/workspace-state.use-case.ts` — the default workspace, activation
- `src/core/workbench/workspace/workspace-shortcut-action.service.ts` — `select_workspace_*`
- `src/core/session/host/session-host.ts`, `session-snapshot.ts` — what a restored terminal shows
- `src/shared/domain/grid-layout.ts` — what a saved layout contains

**Required sections:** what a workspace is; the panel actions in one table; that
switching keeps the other workspaces' processes running while close/delete ends
them; keyboard shortcuts and how `1…9` map to the panel order; the default
workspace; what is and is not restored after a restart (nothing is re-run);
`terminal.restore.*`; manual saving with `terminal.restore.enabled = false`.
Do not document multi-window behaviour.

---

## Sidebar (`../meetcogno/astro.config.mjs`)

Grouped, most important first. Features are ordered by how central they are to
Cogno, not alphabetically.

```text
Getting started
Features        Coding Agents · Workspaces · Autocomplete & History · Command Palette
                · Search · Notifications · Git · Process Info
Configuration   Overview · Shell profiles · Prompt · Keybindings · All settings · All actions
CLI
Help            Logging & troubleshooting
```

Everything about the config file sits in one group: explanation first, the two
generated references last. `/docs/actions` redirects to `/docs/config/actions`.

When a feature page is added: create the page, add the sidebar entry, add it to
`index.md` and `getting-started.md`, add a page section above with its sources.
