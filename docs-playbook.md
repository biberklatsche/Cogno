# Cogno Docs Playbook

Instructions for an agent generating the Cogno website documentation. The agent
reads this file, reads the listed source files, and writes the output markdown.

**Command:**
> "Read `docs-playbook.md` and generate the documentation."

Run it from the Cogno project root. Output files are overwritten on each run.
Only use information found in the sources — never invent settings or defaults.

---

## The one rule: generated tables are not re-derived

Two references are generated from the code and checked by `pnpm lint`. They are
the source of truth; **base the website pages on them and never hand-write or
re-derive their content**:

| Generated file | Produced by | Contains |
|---|---|---|
| `docs/config.md` | `pnpm generate:config-docs` (Zod schemas + `default-config-values.ts`) | every setting: key, type, default, description |
| `docs/actions.md` | `pnpm generate:actions` (core action catalog + feature definitions) | every action: name, description, default keybindings |

If a setting or action looks wrong in there, fix the `.describe()` / catalog
entry in the code and regenerate — do not patch the website page.

Everything else in this playbook is **prose**: concepts, walkthroughs, examples.
That is what the agent actually writes.

---

## How to update this playbook

- New setting → add `.describe()` in its Zod schema, run `pnpm generate:config-docs`.
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
---
```

- **Language:** English
- `##` for top-level sections, `###` for sub-sections
- Setting and action names in backticks, e.g. `font.size`, `open_git`
- Hex colours without `#`, e.g. `0e1925`
- Code examples: `text` for config snippets, `bash` for shell commands
- Keep prose short — tables and examples carry the weight

---

## Pages to generate

### Page 1 — Configuration

**Write to:** `../meetcogno/src/content/docs/docs/config.md`

**Source:** `docs/config.md` (generated — the complete settings table) plus
`README.md` for the file location and CLI.

**Required sections:**
- Where the config lives: `~/.cogno/cogno.config`, `~/.cogno-dev/cogno.config` in
  development builds
- Format: `key = value`, dot notation for nesting, `[a, b]` for arrays; only
  overrides need to be present, Cogno merges them with the built-in defaults
- The full settings tables, taken from the generated `docs/config.md`
- Short worked examples that the generated table cannot express:
  - two shell profiles with one set as default
  - a two-segment prompt (directory + error indicator using `when = returnCode!=0`)
  - a few keybinding lines
- Keybinding syntax: `[trigger:]combo[>combo...]=action[:arg...]`, triggers
  `always` / `performable` / `broadcast` / `unconsumed`, `+` joins modifiers,
  `>` chains combos, multiple `keybind =` lines are additive

### Page 2 — CLI

**Write to:** `../meetcogno/src/content/docs/docs/cli.md`

**Source:** `README.md` (CLI synopsis).

**Required sections:** launch flags `--config <path>`, `--set key=value`;
`cogno config` (`show`, `show --defaults`, `get <key>`, `path`); `cogno action`
(`list`, `run <name> [args...]`). One example per command.

### Page 3 — Actions

**Write to:** `../meetcogno/src/content/docs/docs/actions.md`

**Source:** `docs/actions.md` (generated).

**Required sections:** short explanation that core actions come from the catalog
and each feature contributes its own; the full grouped table from the generated
file; CLI usage (`cogno action list`, `cogno action run <name>`).

### Page 4 — Autocomplete

**Write to:** `../meetcogno/src/content/docs/docs/autocomplete.md`

**Sources:**
- `src/core/session/autocomplete/terminal-autocomplete.service.ts` — constants (max suggestions, visible items, debounce, filter modes)
- `src/core/session/autocomplete/suggestors/history-command.suggestor.ts`
- `src/core/session/autocomplete/suggestors/command-pattern.suggestor.ts`
- `src/core/session/autocomplete/suggestors/history-directory.suggestor.ts`
- `src/features/autocomplete/` — the spec-command suggestor (1000+ CLI tools)

**Required sections:** how suggestions appear; the suggestion sources (history
commands, history patterns, history directories, spec commands); filter modes and
how `cycle_tab` cycles them; keyboard handling. Settings: link to the generated
`autocomplete.*` and `terminal.history.*` rows.

### Page 5 — Notifications

**Write to:** `../meetcogno/src/content/docs/docs/notifications.md`

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

**Write to:** `../meetcogno/src/content/docs/docs/command-palette.md`

**Sources:**
- `src/features/command-palette/command-palette.service.ts`
- `src/features/command-palette/command-palette.feature-definition.ts`

**Required sections:** what it shows (all registered actions with keybindings,
filterable, keyboard-navigable, rebuilt when the config changes); keyboard
handling. Setting: `feature.command_palette.mode`. Action: `open_command_palette`.

### Page 7 — Search

**Write to:** `../meetcogno/src/content/docs/docs/search.md`

**Sources:**
- `src/features/terminal-search/terminal-search.service.ts`
- `src/features/terminal-search/terminal-search.feature-definition.ts`

**Required sections:** searches the active terminal's scrollback; debounce;
results with line numbers, selecting one scrolls the terminal; pagination;
options (case-sensitive, regex, block search); keyboard handling. Settings: the
generated `terminal.decoration.*` (match colours) and `feature.search.*` rows.
Action: `open_terminal_search`.

### Page 8 — Git

**Write to:** `../meetcogno/src/content/docs/docs/git.md`

**Sources:**
- `src/features/git/git-status.service.ts`
- `src/features/git/git-diff.service.ts`
- `src/features/git/git.feature-definition.ts`

**Required sections:** the panel follows the focused terminal's working directory
and shows the repository status; the diff view; that it runs `git` in that
directory, so it is unavailable in remote (SSH) sessions. Setting:
`feature.git.mode` (off by default). Action: `open_git`.

### Page 9 — Process Info

**Write to:** `../meetcogno/src/content/docs/docs/process-info.md`

**Sources:**
- `src/features/process-info/process-info.service.ts`
- `src/features/process-info/process-info.feature-definition.ts`

**Required sections:** shows the process tree of the focused session and polls
while the panel is open; the lock toggle that freezes the panel on one session
instead of following focus; the unbound/closing/closed states. Setting:
`feature.process_info.mode`. Action: `open_process_info`.

### Page 10 — Coding Agents

**Write to:** `../meetcogno/src/content/docs/docs/coding-agents.md`

**Sources:**
- `src/features/coding-agent/coding-agent-status.service.ts`
- `src/features/coding-agent/coding-agent-provider-registry.service.ts`
- `src/features/coding-agent/providers/` — one directory per supported agent
- `src/features/coding-agent/coding-agents.feature-definition.ts`

**Required sections:** Cogno detects coding agents running in a terminal and
shows their state (working, question, ready, error) in the tab and the side
panel; which agents are supported (read the providers directory — do not
hard-code the list); notifications per state. Settings: the generated
`feature.coding_agents.*` rows. Action: `open_coding_agents`.

---

## Sidebar (`../meetcogno/astro.config.mjs`)

```js
sidebar: [
  { label: 'Getting started',  slug: 'docs/getting-started' },
  { label: 'Workspaces',       slug: 'docs/workspaces' },
  { label: 'Autocomplete',     slug: 'docs/autocomplete' },
  { label: 'Notifications',    slug: 'docs/notifications' },
  { label: 'Search',           slug: 'docs/search' },
  { label: 'Command Palette',  slug: 'docs/command-palette' },
  { label: 'Git',              slug: 'docs/git' },
  { label: 'Process Info',     slug: 'docs/process-info' },
  { label: 'Coding Agents',    slug: 'docs/coding-agents' },
  { label: 'Config',           slug: 'docs/config' },
  { label: 'CLI',              slug: 'docs/cli' },
  { label: 'Actions',          slug: 'docs/actions' },
],
```

When a feature page is added: create the page, add the sidebar entry, add a page
section above with its sources.
