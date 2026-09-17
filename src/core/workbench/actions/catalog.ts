import { defineAction } from "@cogno/shared/domain";

/** The numbered shortcuts: shell profiles, tabs and workspaces 1 to 9. */
export const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * The catalog of every core action: its name, human label, description and the
 * default keybindings per platform (linux shares the windows defaults; macos
 * overrides only where it differs). This is the single source of truth the code
 * generator reads to emit the Rust action list, the default configs' keybinds
 * and docs/actions.md - do not hand-maintain those copies.
 */
export const coreActionCatalog = [
  defineAction({
    name: "copy",
    label: "Copy",
    description: "Copy the selected text to the clipboard",
    defaultKeys: {
      default: [{ combo: "Ctrl+C", always: true, performable: true }],
      macos: [{ combo: "Command+C", always: true, performable: true }],
    },
  }),
  defineAction({
    name: "paste",
    label: "Paste",
    description: "Paste from the clipboard",
    defaultKeys: {
      default: [{ combo: "Control+V", always: true }],
      macos: [{ combo: "Command+V", always: true }],
    },
  }),
  defineAction({
    name: "cut",
    label: "Cut",
    description: "Cut the selected text to the clipboard",
    defaultKeys: {
      default: [{ combo: "Ctrl+X", always: true, performable: true }],
      macos: [{ combo: "Command+X", always: true, performable: true }],
    },
  }),
  defineAction({
    name: "new_tab",
    label: "New Tab",
    description: "Open a new terminal tab",
    defaultKeys: {
      default: [{ combo: "Ctrl+T", always: true }],
      macos: [{ combo: "Command+T", always: true }],
    },
  }),
  defineAction({
    name: "close_tab",
    label: "Close Tab",
    description: "Close the current tab",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+W", always: true }],
      macos: [{ combo: "Control+Shift+W", always: true }],
    },
  }),
  defineAction({
    name: "select_next_tab",
    label: "Select Next Tab",
    description: "Switch to the next/previous tab",
    defaultKeys: {
      default: [{ combo: "Ctrl+PageDown", always: true }],
      macos: [{ combo: "Command+PageDown", always: true }],
    },
  }),
  defineAction({
    name: "select_previous_tab",
    label: "Select Previous Tab",
    description: "Switch to the next/previous tab",
    defaultKeys: {
      default: [{ combo: "Ctrl+PageUp", always: true }],
      macos: [{ combo: "Command+PageUp", always: true }],
    },
  }),
  defineAction({
    name: "select_next_pane",
    label: "Select Next Pane",
    description: "Switch focus between panes",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+PageDown", always: true }],
      macos: [{ combo: "Command+Shift+PageDown", always: true }],
    },
  }),
  defineAction({
    name: "select_previous_pane",
    label: "Select Previous Pane",
    description: "Switch focus between panes",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+PageUp", always: true }],
      macos: [{ combo: "Command+Shift+PageUp", always: true }],
    },
  }),
  defineAction({
    name: "split_right",
    label: "Split Right",
    description: "Split the current pane to the right",
    defaultKeys: {
      default: [{ combo: "Ctrl+R", always: true }],
      macos: [{ combo: "Command+R", always: true }],
    },
  }),
  defineAction({
    name: "split_left",
    label: "Split Left",
    description: "Split the current pane to the left",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+R", always: true }],
      macos: [{ combo: "Command+Shift+R", always: true }],
    },
  }),
  defineAction({
    name: "split_down",
    label: "Split Down",
    description: "Split the current pane downward",
    defaultKeys: {
      default: [{ combo: "Ctrl+D", always: true }],
      macos: [{ combo: "Command+D", always: true }],
    },
  }),
  defineAction({
    name: "split_up",
    label: "Split Up",
    description: "Split the current pane upward",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+D", always: true }],
      macos: [{ combo: "Command+Shift+D", always: true }],
    },
  }),
  defineAction({
    name: "maximize_pane",
    label: "Maximize Pane",
    description: "Maximize the active pane",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+Enter", always: true }],
      macos: [{ combo: "Command+Shift+Enter", always: true }],
    },
  }),
  defineAction({
    name: "minimize_pane",
    label: "Minimize Pane",
    description: "Restore a maximized pane",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+Enter", always: true }],
      macos: [{ combo: "Command+Shift+Enter", always: true }],
    },
  }),
  defineAction({
    name: "close_terminal",
    label: "Close Terminal",
    description: "Close the active terminal pane",
    defaultKeys: {
      default: [{ combo: "Ctrl+W", always: true }],
      macos: [{ combo: "Command+W", always: true }],
    },
  }),
  defineAction({
    name: "clear_buffer",
    label: "Clear Buffer",
    description: "Clear the terminal scrollback buffer",
    defaultKeys: { default: [{ combo: "Ctrl+Alt+C" }], macos: [{ combo: "Command+Alt+C" }] },
  }),
  defineAction({
    name: "close_other_tabs",
    label: "Close Other Tabs",
    description: "Close all tabs except the current one",
    defaultKeys: {
      default: [{ combo: "Alt+W", always: true }],
      macos: [{ combo: "Option+Shift+W", always: true }],
    },
  }),
  defineAction({
    name: "close_all_tabs",
    label: "Close All Tabs",
    description: "Close all tabs",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+Q", always: true }],
      macos: [{ combo: "Command+Shift+Q", always: true }],
    },
  }),
  defineAction({
    name: "quit",
    label: "Quit",
    description: "Quit Cogno",
    defaultKeys: {
      default: [{ combo: "Ctrl+Q", always: true }],
      macos: [{ combo: "Command+Q", always: true }],
    },
  }),
  defineAction({
    name: "new_window",
    label: "New Window",
    description: "Open a new Cogno window",
    defaultKeys: {
      default: [{ combo: "Ctrl+N", always: true }],
      macos: [{ combo: "Command+N", always: true }],
    },
  }),
  defineAction({
    name: "close_window",
    label: "Close Window",
    description: "Close the current window",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+Alt+W", always: true }],
      macos: [{ combo: "Command+Shift+Option+W", always: true }],
    },
  }),
  defineAction({
    name: "minimize_window",
    label: "Minimize Window",
    description: "Minimize the current window",
  }),
  defineAction({
    name: "open_config",
    label: "Settings",
    description: "Open the config file in the default editor",
    defaultKeys: {
      default: [{ combo: "Ctrl+,", always: true }],
      macos: [{ combo: "Command+,", always: true }],
    },
  }),
  defineAction({
    name: "load_config",
    label: "Reload Configuration",
    description: "Reload the config file without restarting",
  }),
  defineAction({
    name: "trigger_autocomplete",
    label: "Trigger Autocomplete",
    description: "Manually trigger autocomplete suggestions",
    defaultKeys: { default: [{ combo: "Ctrl+Space" }], macos: [{ combo: "Control+Space" }] },
  }),
  defineAction({
    name: "trigger_command_history",
    label: "Trigger Command History",
    description: "Open the command history dropdown",
  }),
  defineAction({
    name: "cycle_tab",
    label: "Cycle Tab",
    description:
      "Cycle through available autocomplete modes (or history scope, while that dropdown is open)",
    defaultKeys: { default: [{ combo: "Tab" }] },
  }),
  defineAction({
    name: "clear_line",
    label: "Clear Line",
    description: "Clear the current input line",
    defaultKeys: { default: [{ combo: "Ctrl+Y" }], macos: [{ combo: "Command+Y" }] },
  }),
  defineAction({
    name: "clear_line_to_end",
    label: "Clear Line To End",
    description: "Delete from the cursor to the end of the line",
    defaultKeys: { default: [{ combo: "Ctrl+K" }], macos: [{ combo: "Command+K" }] },
  }),
  defineAction({
    name: "clear_line_to_start",
    label: "Clear Line To Start",
    description: "Delete from the cursor to the start of the line",
    defaultKeys: { default: [{ combo: "Ctrl+L" }], macos: [{ combo: "Command+L" }] },
  }),
  defineAction({
    name: "delete_previous_word",
    label: "Delete Previous Word",
    description: "Delete the word before the cursor",
    defaultKeys: {
      default: [{ combo: "Ctrl+Alt+Left" }],
      macos: [{ combo: "Command+Option+Left" }],
    },
  }),
  defineAction({
    name: "delete_next_word",
    label: "Delete Next Word",
    description: "Delete the word after the cursor",
    defaultKeys: {
      default: [{ combo: "Ctrl+Alt+Right" }],
      macos: [{ combo: "Command+Option+Right" }],
    },
  }),
  defineAction({
    name: "go_to_next_word",
    label: "Go To Next Word",
    description: "Move the cursor forward by one word",
    defaultKeys: { default: [{ combo: "Ctrl+Right" }], macos: [{ combo: "Option+Right" }] },
  }),
  defineAction({
    name: "go_to_previous_word",
    label: "Go To Previous Word",
    description: "Move the cursor backward by one word",
    defaultKeys: { default: [{ combo: "Ctrl+Left" }], macos: [{ combo: "Option+Left" }] },
  }),
  defineAction({
    name: "go_to_start_of_line",
    label: "Go To Start Of Line",
    description: "Move the cursor to the start of the line",
    defaultKeys: { default: [{ combo: "Home" }], macos: [{ combo: "Command+Left" }] },
  }),
  defineAction({
    name: "go_to_end_of_line",
    label: "Go To End Of Line",
    description: "Move the cursor to the end of the line",
    defaultKeys: { default: [{ combo: "End" }], macos: [{ combo: "Command+Right" }] },
  }),
  defineAction({
    name: "select_all",
    label: "Select All",
    description: "Select all text in the terminal",
    defaultKeys: { default: [{ combo: "Ctrl+A" }], macos: [{ combo: "Command+A" }] },
  }),
  defineAction({
    name: "select_text_right",
    label: "Select Text Right",
    description: "Extend the selection one character right/left",
    defaultKeys: { default: [{ combo: "Shift+Right" }] },
  }),
  defineAction({
    name: "select_text_left",
    label: "Select Text Left",
    description: "Extend the selection one character right/left",
    defaultKeys: { default: [{ combo: "Shift+Left" }] },
  }),
  defineAction({
    name: "select_word_right",
    label: "Select Word Right",
    description: "Extend the selection one word right/left",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+Right" }],
      macos: [{ combo: "Command+Shift+Right" }],
    },
  }),
  defineAction({
    name: "select_word_left",
    label: "Select Word Left",
    description: "Extend the selection one word right/left",
    defaultKeys: {
      default: [{ combo: "Ctrl+Shift+Left" }],
      macos: [{ combo: "Command+Shift+Left" }],
    },
  }),
  defineAction({
    name: "select_text_to_end_of_line",
    label: "Select Text To End Of Line",
    description: "Extend selection to line boundary",
    defaultKeys: { default: [{ combo: "Ctrl+Shift+M" }], macos: [{ combo: "Command+Shift+M" }] },
  }),
  defineAction({
    name: "select_text_to_start_of_line",
    label: "Select Text To Start Of Line",
    description: "Extend selection to line boundary",
    defaultKeys: { default: [{ combo: "Ctrl+Shift+N" }], macos: [{ combo: "Command+Shift+N" }] },
  }),
  ...SLOTS.map((slot) =>
    defineAction({
      name: `open_shell_${slot}`,
      label: `Open Shell ${slot}`,
      description: `Open a new tab with shell profile ${slot}`,
      defaultKeys: {
        default: [{ combo: `Ctrl+Shift+${slot}`, always: true }],
        macos: [{ combo: `Command+Shift+${slot}`, always: true }],
      },
    }),
  ),
  ...SLOTS.map((slot) =>
    defineAction({
      name: `select_tab_${slot}`,
      label: `Select Tab ${slot}`,
      description: `Jump to tab ${slot}`,
      defaultKeys: {
        default: [{ combo: `Ctrl+${slot}`, always: true }],
        macos: [{ combo: `Command+${slot}`, always: true }],
      },
    }),
  ),
  ...SLOTS.map((slot) =>
    defineAction({
      name: `select_workspace_${slot}`,
      label: `Select Workspace ${slot}`,
      description: `Switch to workspace ${slot}`,
      defaultKeys: {
        default: [{ combo: `Ctrl+Alt+${slot}`, always: true }],
        macos: [{ combo: `Command+Alt+${slot}`, always: true }],
      },
    }),
  ),
  defineAction({
    name: "select_workspace_default",
    label: "Select Workspace Default",
    description: "Switch to the default workspace",
    defaultKeys: {
      default: [{ combo: "Ctrl+Alt+0", always: true }],
      macos: [{ combo: "Command+Alt+0", always: true }],
    },
  }),
  defineAction({
    name: "open_documentation",
    label: "Open Documentation",
    description: "Open the Cogno documentation",
  }),
  defineAction({
    name: "open_about",
    label: "About Cogno",
    description: "Show the About dialog",
  }),
] as const;

/** The union of every core action name; typos in actions.handle(...) fail here. */
export type CoreActionName = (typeof coreActionCatalog)[number]["name"];

const coreActionNameSet: ReadonlySet<string> = new Set(
  coreActionCatalog.map((entry) => entry.name),
);

/** The core action names as a plain list (the old core-action-names.ts surface). */
export const coreActionNames: ReadonlyArray<CoreActionName> = coreActionCatalog.map(
  (entry) => entry.name,
);

/** Narrow an arbitrary string (config/CLI/HTTP) to a known core action, or undefined. */
export function toKnownCoreAction(name: string): CoreActionName | undefined {
  return coreActionNameSet.has(name) ? (name as CoreActionName) : undefined;
}
