# Cogno Docs Playbook

This file contains precise instructions for an AI agent to generate the Cogno documentation.
The agent reads this file, reads all listed source files, and writes the output markdown files.

**Command to regenerate docs:**
> "Read `docs-playbook.md` and generate the documentation."

Run this command from the `cogno2` project directory. All output files are overwritten on each run.
Only use information found in the source files — do not invent settings or defaults.

---

## How to update this playbook

When a setting is added or changed in Cogno:
1. Identify which source files changed (usually `feature-settings.contract.ts` or a `+models/*-config.ts`)
2. If the file is not yet listed in the relevant page's sources, add it
3. Add the new setting key to the relevant "Required settings" section below
4. Regenerate docs

---

## Output format

Each output file uses Starlight-compatible Markdown with this frontmatter:

```markdown
---
title: Page Title
description: Short one-sentence description.
---
```

Rules for generated content:
- **Language:** English
- **Section headers:** `##` for top-level, `###` for sub-sections
- **Settings tables:** columns are `Setting | Type | Default | Description`
- **Setting names** in backticks, e.g. `font.size`
- **Hex colors** without `#`, e.g. `0e1925`
- **Booleans:** `true` / `false`
- **Enums:** list all allowed values in backticks, e.g. `"off"` `"hidden"` `"visible"`
- **Code examples** use language `text` for config snippets, `bash` for shell commands
- Keep prose short — tables and examples carry the weight
- If a field is optional with no default, write `—` in the Default column

---

## Pages to generate

---

### Page 1 — Configuration Reference

**Write to:** `../meetcogno/src/content/docs/docs/config.md`

**Purpose:** Complete reference for the Cogno config file. Every available setting,
its type, default value, and a brief description. Also covers the config CLI.

**Source files** (paths relative to cogno2 root):

| File | What it contains |
|---|---|
| `README.md` | CLI syntax and config file location |
| `src-tauri/src/default_macos.config` | All default values (authoritative source for defaults) |
| `src/packages/app/config/+models/config.ts` | Top-level Zod schema combining all sub-schemas |
| `src/packages/core-api/feature-settings.contract.ts` | Feature Zod schemas (workspace, notification, terminal, autocomplete, search, AI) |
| `src/packages/app/config/+models/font-config.ts` | Font schema |
| `src/packages/app/config/+models/color-config.ts` | Color schema |
| `src/packages/app/config/+models/cursor-config.ts` | Cursor schema |
| `src/packages/app/config/+models/padding-config.ts` | Padding schema |
| `src/packages/app/config/+models/image-config.ts` | Background image schema |
| `src/packages/app/config/+models/menu-config.ts` | Menu schema |
| `src/packages/app/config/+models/scrollbar-config.ts` | Scrollbar schema |
| `src/packages/app/config/+models/selection-config.ts` | Selection schema |
| `src/packages/app/config/+models/clipboard-config.ts` | Clipboard schema |
| `src/packages/app/config/+models/shell-config.ts` | Shell and profile schema |
| `src/packages/app/config/+models/prompt-config.ts` | Prompt segment schema |
| `src/packages/app/config/+models/keybind-config.ts` | Keybinding schema |
| `src/packages/features/ai/ai.models.ts` | AI provider capability types |
| `src/packages/products/ai-detectable-provider-definitions.ts` | Auto-detected provider definitions (Ollama, LM Studio URLs) |
| `src/packages/app/action/core-action-names.ts` | Core action names (terminal/window actions; does NOT include side-menu feature actions) |
| `src/packages/features/side-menu/*/feature-definition.ts` | Each side-menu feature defines its own `actionName` — read all of them |

**Required sections (generate in this order):**

#### Overview

Explain what the config file is and where it lives:
- Production: `~/.cogno/cogno.config`
- Development builds: `~/.cogno-dev/cogno.config`
- Format: plain `key = value` pairs, dot-notation for nesting, array values with `[item1, item2]`
- Only user overrides need to be set — Cogno merges them with built-in defaults
- Setting: `enable_watch_config` (boolean, default: `true`) — reload config automatically when the file changes

#### CLI

Document all CLI commands with a brief example each:

Config commands:
- `cogno config show` — show current user overrides only
- `cogno config show --defaults` — show full effective config including built-in defaults
- `cogno config get <key>` — print a single value
- `cogno config path` — print the path to the config file
- `cogno --set key=value` — override a value for a single run (does not write to file)

Action commands:
- `cogno action list` — print all available action names
- `cogno action run <name> [args...]` — trigger an action by name

#### Actions

Full table of every callable action name and what it does.

**Important — two sources, not one:**
The action catalog is built from `core-action-names.ts` PLUS the `actionName` of every
registered side-menu feature definition. Side-menu features manage their own action name;
it must NOT be added to `core-action-names.ts`. When generating this section, read both:
- `src/packages/app/action/core-action-names.ts` — core/terminal actions
- All `*.feature-definition.ts` files under `src/packages/features/side-menu/` — one `actionName` each

Group by category: Clipboard, Buffer, Cursor movement, Text selection, Tabs, Panes,
Shell profiles, Window, Workspaces, Autocomplete, Features (side-menu).

Descriptions for each action (derive from name, match these):
- `copy` — Copy the selected text to the clipboard
- `cut` — Cut the selected text to the clipboard
- `paste` — Paste from the clipboard
- `clear_buffer` — Clear the terminal scrollback buffer
- `clear_line` — Clear the current input line
- `clear_line_to_end` — Delete from the cursor to the end of the line
- `clear_line_to_start` — Delete from the cursor to the start of the line
- `delete_previous_word` — Delete the word before the cursor
- `delete_next_word` — Delete the word after the cursor
- `go_to_start_of_line` — Move the cursor to the start of the line
- `go_to_end_of_line` — Move the cursor to the end of the line
- `go_to_next_word` — Move the cursor forward by one word
- `go_to_previous_word` — Move the cursor backward by one word
- `select_all` — Select all text in the terminal
- `select_text_right` / `select_text_left` — Extend the selection one character right/left
- `select_word_right` / `select_word_left` — Extend the selection one word right/left
- `select_text_to_end_of_line` / `select_text_to_start_of_line` — Extend selection to line boundary
- `new_tab` — Open a new terminal tab
- `close_tab` — Close the current tab
- `close_terminal` — Close the active terminal pane
- `close_other_tabs` — Close all tabs except the current one
- `close_all_tabs` — Close all tabs
- `select_next_tab` / `select_previous_tab` — Switch to the next/previous tab
- `select_tab_1` … `select_tab_9` — Jump to a tab by position
- `split_right` / `split_left` / `split_down` / `split_up` — Split the current pane
- `maximize_pane` — Maximize the active pane
- `minimize_pane` — Restore a maximized pane
- `select_next_pane` / `select_previous_pane` — Switch focus between panes
- `open_shell_1` … `open_shell_9` — Open a new tab with shell profile by slot number
- `new_window` — Open a new Cogno window
- `close_window` — Close the current window
- `minimize_window` — Minimize the current window
- `quit` — Quit Cogno
- `open_config` — Open the config file in the default editor
- `load_config` — Reload the config file without restarting
- `open_workspace` — Toggle the workspace panel
- `open_command_palette` — Toggle the command palette
- `open_notification` — Toggle the notification panel
- `open_ai_chat` — Toggle the AI chat panel
- `open_terminal_search` — Toggle the in-terminal search bar
- `trigger_autocomplete` — Manually trigger autocomplete suggestions
- `cycle_tab` — Cycle through available autocomplete modes (or history scope, while that dropdown is open)
- `select_workspace_default` — Switch to the default workspace
- `select_workspace_1` … `select_workspace_9` — Switch to a workspace by slot number

#### Font

Settings: `font.family`, `font.size`, `font.weight`, `font.weight_bold`, `font.enable_ligatures`,
`font.custom_glyphs`, `font.draw_bold_text_in_bright_colors`, `font.rescale_overlapping_glyphs`,
`font.app.family`, `font.app.size`

Use defaults from `src-tauri/src/default_macos.config`. Read font schema for valid types/enums.

#### Colors

Settings: `color.foreground`, `color.background`, `color.highlight`, `color.black`, `color.red`,
`color.green`, `color.yellow`, `color.blue`, `color.magenta`, `color.cyan`, `color.white`,
and all `color.bright_*` variants (bright_black through bright_white).

Note: values are 6-digit hex colors without `#`. Transparency via 8-digit hex (last two digits = alpha).

#### Cursor

Settings: `cursor.style` (enum: read from schema), `cursor.width`, `cursor.blink`,
`cursor.color`, `cursor.accent_color`, `cursor.alt_click_moves_cursor`

#### Padding

Settings: `padding.left`, `padding.right`, `padding.top`, `padding.bottom`,
`padding.remove_on_full_screen_app`

#### Background Image

Settings: `background_image.path`, `background_image.opacity`, `background_image.blur`

Note: `background_image.path` is empty by default (no image). `opacity` is 0–100.

#### Menu

Settings: `menu.opacity` (0–100)

#### Scrollbar

Settings: `scrollbar.width`, `scrollbar.sensitivity`, `scrollbar.scroll_on_user_input`,
`scrollbar.smooth_scroll_duration`, `scrollbar.fast_scroll_sensitivity`, `scrollbar.scrollback_lines`,
`scrollbar.overview_ruler_border_color`, `scrollbar.slider_color`,
`scrollbar.slider_hover_color`, `scrollbar.slider_active_color`

#### Selection

Settings: `selection.clear_on_copy`, `selection.background_color`,
`selection.inactive_background_color`, `selection.right_click_selects_word`

#### Clipboard

Settings: `clipboard.read` (enum: `allow` / `deny`), `clipboard.write` (enum: `allow` / `deny`),
`clipboard.trim_trailing_spaces`, `clipboard.image_paste_ttl_seconds`

#### Shell

Settings: `shell.default` (name of the default profile), `shell.order` (array of profile names),
and for each profile under `shell.profiles.<name>`:
- `shell_type` (enum: `PowerShell` `ZSH` `Bash` `GitBash` `Fish`)
- `path` (optional custom executable path)
- `args` (optional array of launch arguments)
- `env` (optional key-value map of environment variables)
- `working_dir` (optional starting directory)
- `inject_cogno_cli` (boolean, default: `true`)
- `enable_shell_integration` (boolean, default: `true`)
- `load_user_rc` (boolean, default: `true`)
- `use_conpty` (boolean, optional — Windows only)

Constraints: max 9 profiles. `shell.default` must match an existing profile name.

Include a short example defining two profiles and setting one as default.

#### Prompt

Cogno renders a configurable prompt using segments. Each segment is a block with optional
text content, color, padding, and display conditions.

Settings:
- `prompt.active` — name of the active prompt profile
- `prompt.profile.<name>.order` — array of segment names to display, in order
- For each segment `prompt.segment.<name>`:
  - `field` — data field to display: `directory`, `user`, `machine`, `duration`
  - `text` — static text (alternative to field)
  - `foreground` — text color (hex)
  - `background` — background color (hex)
  - `bold` — boolean
  - `size` — font size override
  - `padding_left`, `padding_right` — inner padding
  - `margin_left` — outer left margin
  - `radius_left`, `radius_right` — corner radius
  - `when` — condition: `returnCode==0` or `returnCode!=0`
  - `format` — value format, e.g. `timespan` for duration

Include a short example with a two-segment prompt (directory + error indicator).

#### Keybindings

Format: `keybind = [scope:][performable:]combo[>combo...]=action[:arg...]`

- `scope`: `always` fires the binding even when a text input has focus (e.g. search box)
- `performable`: only fires if the action is currently available
- Combos use `+` to join modifiers and key names, e.g. `Command+T`, `Control+Shift+W`
- Chord sequences: two combos joined with `>`, e.g. `Control+X>Control+S`
- Multiple `keybind =` lines are additive

List all available actions (read them from the keybind lines in `src-tauri/src/default_macos.config`),
grouped by category (navigation, editing, window management, feature toggles).

Include three illustrative examples from the default config.

#### Terminal

Settings (under `terminal.*`):
- `terminal.webgl` (boolean) — use WebGL renderer
- `terminal.inactive_overlay_opacity` (int 0–100) — dimming of inactive panes
- `terminal.allow_transparency` (boolean) — allow transparent backgrounds
- `terminal.tab_stop_width` (number) — tab character width
- `terminal.minimum_contrast_ratio` (number) — minimum contrast for readability
- `terminal.screen_reader_mode` (boolean) — enable accessibility mode
- `terminal.word_separator` (string) — characters treated as word boundaries
- `terminal.progress_bar.enabled` (boolean) — show progress bar in terminal header

#### Autocomplete

Settings:
- `autocomplete.provider.timeout_ms` (int, min 1, default 160) — max time for a dynamic provider response

#### Search

Settings:
- `search.mode` (enum: `"off"` `"hidden"` `"visible"`)
- `search.match.background_color`, `search.match.border_color`, `search.match.overview_ruler_color`
- `search.active_match.background_color`, `search.active_match.border_color`, `search.active_match.overview_ruler_color`

#### Workspace

Settings:
- `workspace.mode` (enum: `"off"` `"hidden"` `"visible"`)

#### Notifications

Two separate setting prefixes exist: `notification.*` (behavior) and `notifications.*` (delivery channels).

Settings under `notification.*`:
- `notification.mode` (enum: `"off"` `"hidden"` `"visible"`)
- `notification.highlight_terminal_on_activity` (boolean)
- `notification.long_running_commands.enabled` (boolean)
- `notification.long_running_commands.minimum_duration_seconds` (int ≥ 0)
- `notification.exceptions.handled.enabled` (boolean)
- `notification.exceptions.unhandled.enabled` (boolean)
- `notification.overview.max_items` (int ≥ 0)

Settings under `notifications.*`:
- `notifications.app.available` (boolean) — whether in-app notifications are available
- `notifications.app.enabled` (boolean) — show in-app notifications
- `notifications.app.duration_seconds` (int ≥ 0) — auto-dismiss delay
- `notifications.os.available` (boolean) — whether OS notifications are available
- `notifications.os.enabled` (boolean) — send OS notifications

#### Command Palette

Settings:
- `command_palette.mode` (enum: `"off"` `"hidden"` `"visible"`)

#### AI

Settings:
- `ai.mode` (enum: `"off"` `"hidden"` `"visible"` `"auto"`)  
  `"auto"` enables AI automatically if at least one usable provider is configured.  
  A provider is usable when: `enabled` is not `false`, `type` is valid, `base_url` is non-empty, `model` is non-empty.

- `ai.active_provider` (string) — ID of the provider to use

Under `ai.providers.<name>` (where `<name>` is any identifier you choose):
- `type` (enum: `"openai_compatible"` `"ollama_native"`) — required
- `base_url` (string) — API endpoint base URL, required for operation
- `model` (string) — model name/ID, required for operation
- `api_key` (string) — API key, for OpenAI-compatible APIs
- `headers` (key-value map) — custom HTTP request headers
- `enabled` (boolean) — set to `false` to disable without removing
- `auto_detected` (boolean) — set by Cogno automatically; do not set manually

Under `ai.request`:
- `ai.request.include_process_tree` (boolean, default `false`) — include process tree in AI context
- `ai.request.max_commands` (int, default `8`) — max number of recent commands sent to AI
- `ai.request.max_output_chars` (int, default `4000`) — max terminal output characters sent to AI

**Auto-detection:** Cogno probes `http://localhost:11434` (Ollama) and `http://localhost:1234` (LM Studio)
on startup. Detected providers are added with `auto_detected = true`. Setting `enabled = false`
for an auto-detected provider prevents it from being re-detected.

Include a full working example for:
1. Adding an Ollama provider (`ollama_native`)
2. Adding an OpenAI-compatible provider (e.g. LM Studio or OpenAI)

---

### Page 2 — CLI

**Write to:** `../meetcogno/src/content/docs/docs/cli.md`

**Purpose:** All Cogno CLI commands and launch flags in one place.

**Source files:**
- `README.md` — full CLI synopsis

**Required sections:**
- Launch flags: `--config <path>`, `--set key=value` — with examples
- `cogno config` subcommands: `show`, `show --defaults`, `get <key>`, `path`
- `cogno action` subcommands: `list`, `run <name> [args...]`

---

### Page 3 — Actions

**Write to:** `../meetcogno/src/content/docs/docs/actions.md`

**Purpose:** Complete table of every callable action with a description. Also explains the
two-source architecture (core list + side-menu features).

**Source files:**
- `src/packages/app/action/core-action-names.ts` — core actions
- All `src/packages/features/side-menu/*/feature-definition.ts` — side-menu actions (one `actionName` each)

**Important:** Side-menu feature actions must NOT be in `core-action-names.ts` — each feature
defines its own action and is fully self-contained. Do not add new feature actions to the core list.

**Required sections:**
- Short explanation of the two-source catalog
- Full grouped table: Clipboard, Buffer, Cursor movement, Text selection, Tabs, Panes,
  Shell profiles, Window, Workspaces, Autocomplete, Features (side-menu)
- CLI usage: `cogno action list` and `cogno action run <name>`

---

### Page 4 — Autocomplete

**Write to:** `../meetcogno/src/content/docs/docs/autocomplete.md`

**Purpose:** Explain how autocomplete works and how to configure it.

**Source files:**
- `src/packages/app/terminal/+state/advanced/autocomplete/terminal-autocomplete.service.ts` — constants (MAX_SUGGESTIONS, PANEL_MAX_VISIBLE_ITEMS, MAX_TOP_HISTORY_SUGGESTIONS, debounce ms, filter modes)
- `src/packages/app/terminal/+state/advanced/autocomplete/suggestors/history-command.suggestor.ts`
- `src/packages/app/terminal/+state/advanced/autocomplete/suggestors/history-command-pattern.suggestor.ts`
- `src/packages/app/terminal/+state/advanced/autocomplete/suggestors/history-directory.suggestor.ts`
- `src/packages/features/autocomplete/terminal-autocomplete-suggestor-definitions.ts` — spec suggestor
- `src/packages/core-api/feature-settings.contract.ts` — `FeatureAutocompleteSchema`

**Required sections:**
- How suggestions appear (debounced, panel above/below cursor, max 6 visible, up to 100 ranked)
- Four suggestion sources: history commands, history patterns, history directories, spec commands (1000+ CLI tools)
- Top 3 history suggestions always shown first
- Filter modes: `all`, `history-only`, `context-only` — cycled with `cycle_tab`, persists across sessions
- Keyboard: Tab/↓ next, ↑ previous, Enter accept, Escape dismiss, trigger_autocomplete, cycle_tab
- Config: `autocomplete.provider.timeout_ms`

---

### Page 5 — Notifications

**Write to:** `../meetcogno/src/content/docs/docs/notifications.md`

**Purpose:** Explain what events Cogno notifies about and how to configure them.

**Source files:**
- `src/packages/features/side-menu/notification/notification-center-state.service.ts`
- `src/packages/features/side-menu/notification/notification-side-menu.lifecycle.ts`
- `src/packages/features/side-menu/notification/notification.feature-definition.ts`
- `src/packages/core-api/feature-settings.contract.ts` — `FeatureNotificationSchema`, `FeatureNotificationsSchema`
- `src-tauri/src/default_macos.config` — defaults

**Required sections:**
- Event types: long-running commands, handled exceptions, unhandled exceptions, OSC 9 messages
- Bell icon badge behavior (set on new notification, cleared when panel opens)
- Delivery channels: in-app (auto-dismiss) and OS notifications
- Full config table for `notification.*` and `notifications.*`
- Action: `open_notification`

---

### Page 6 — Command Palette

**Write to:** `../meetcogno/src/content/docs/docs/command-palette.md`

**Purpose:** Explain what the command palette does and how to use it.

**Source files:**
- `src/packages/features/side-menu/command-palette/command-palette.service.ts`
- `src/packages/features/side-menu/command-palette/command-palette.feature-definition.ts`
- `src/packages/core-api/feature-settings.contract.ts` — `FeatureCommandPaletteSchema`

**Required sections:**
- What it shows: all registered actions with their keybindings, filterable, keyboard-navigable
- List is built dynamically from all registered actions and updates when config changes
- Keyboard: type to filter, ↓/↑ navigate, Enter run, Escape close
- Config: `command_palette.mode`
- Action: `open_command_palette`

---

### Page 7 — Search

**Write to:** `../meetcogno/src/content/docs/docs/search.md`

**Purpose:** Explain terminal search and how to configure match colors.

**Source files:**
- `src/packages/features/side-menu/terminal-search/terminal-search.service.ts`
- `src/packages/features/side-menu/terminal-search/terminal-search.feature-definition.ts`
- `src/packages/core-api/feature-settings.contract.ts` — `FeatureSearchSchema`
- `src-tauri/src/default_macos.config` — default colors

**Required sections:**
- Searches the full scrollback buffer of the active terminal
- 120 ms debounce after typing stops
- Results show matching lines with line numbers; selecting a result scrolls the terminal
- Pagination: 200 lines per page, "load more" for additional results
- Options: case-sensitive, regular expression, block search (restrict to buffer range)
- Keyboard: ↓/↑ between results, Enter jump, Escape close and clear highlights
- Full config table for `search.*` (mode + all color settings)
- Action: `open_terminal_search`

---

### Page 8 — AI

**Write to:** `../meetcogno/src/content/docs/docs/ai.md`

**Purpose:** Explain the AI assistant, how context is built, and how to connect a provider.

**Source files:**
- `src/packages/features/side-menu/ai/ai-chat.feature-definition.ts`
- `src/packages/core-api/feature-settings.contract.ts` — `FeatureAiSchema`
- `src/packages/features/ai/ai.models.ts`
- `src/products/ai-detectable-provider-definitions.ts` — Ollama and LM Studio URLs
- `src-tauri/src/default_macos.config` — AI defaults

**Required sections:**
- What it does: sends terminal context (recent commands + output + optional process tree) to a model
- Responses stream token by token; suggested commands can be run directly
- Provider types: `openai_compatible`, `ollama_native`
- Auto-detection: probes Ollama (`http://localhost:11434`) and LM Studio (`http://localhost:1234`) on startup
- Link to Config page for full provider setup (`ai.providers.*`)
- Config table: `ai.mode`, `ai.active_provider`, `ai.request.*`
- Action: `open_ai_chat`

---

## Sidebar (`../meetcogno/astro.config.mjs`)

After generating all pages, ensure the sidebar contains these entries in order:

```js
sidebar: [
  { label: 'Getting started', slug: 'docs/getting-started' },
  { label: 'Workspaces',      slug: 'docs/workspaces' },
  { label: 'Autocomplete',    slug: 'docs/autocomplete' },
  { label: 'Notifications',   slug: 'docs/notifications' },
  { label: 'Search',          slug: 'docs/search' },
  { label: 'Command Palette', slug: 'docs/command-palette' },
  { label: 'AI',              slug: 'docs/ai' },
  { label: 'Config',          slug: 'docs/config' },
  { label: 'CLI',             slug: 'docs/cli' },
  { label: 'Actions',         slug: 'docs/actions' },
],
```

When a new feature page is added:
1. Create `../meetcogno/src/content/docs/docs/<slug>.md`
2. Add a new entry to the sidebar above
3. Add a new Page section to this playbook with sources and required sections
