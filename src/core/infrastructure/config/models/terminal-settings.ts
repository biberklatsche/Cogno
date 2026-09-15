import { hexColorSchema } from "@cogno/shared/contributions";
import { z } from "zod";

const decorationColorSchema = z.object({
  background: hexColorSchema.optional().describe("Fill colour of the decoration."),
  border: hexColorSchema.optional().describe("Border colour of the decoration."),
  overview_ruler: hexColorSchema
    .optional()
    .describe("Marker colour in the overview ruler beside the scrollbar."),
});

export const TerminalSettingsSchema = z.object({
  webgl: z
    .boolean()
    .optional()
    .describe("Render the terminal with the WebGL renderer instead of the canvas one."),
  decoration: z
    .object({
      color: decorationColorSchema
        .optional()
        .describe("Highlight colors for decorated terminal content, e.g. search matches."),
      active_color: decorationColorSchema
        .optional()
        .describe("Highlight colors for the currently active decorated item."),
    })
    .optional()
    .describe("Colours of decorated buffer content such as search matches."),
  inactive_overlay_opacity: z
    .number()
    .int()
    .min(0, "Opacity must be at least 0")
    .max(100, "Opacity must be at most 100")
    .optional()
    .describe("How strongly panes that are not focused are dimmed, 0-100."),
  ignore_bracketed_paste_mode: z
    .boolean()
    .optional()
    .describe("Paste as plain keystrokes even when the shell asked for bracketed paste."),
  minimum_contrast_ratio: z
    .number()
    .optional()
    .describe("Raise text contrast until at least this ratio is met; 1 disables the correction."),
  screen_reader_mode: z.boolean().optional().describe("Expose terminal output to screen readers."),
  allow_transparency: z
    .boolean()
    .optional()
    .describe("Allow transparent background colours; costs some rendering performance."),
  tab_stop_width: z.number().optional().describe("Width of a tab character in columns."),
  word_separator: z
    .string()
    .optional()
    .describe("Characters that end a word for double-click selection and word-wise motion."),
  progress_bar: z
    .object({
      enabled: z.boolean().optional().describe("Show the progress bar in the terminal header."),
    })
    .optional()
    .describe("The OSC 9;4 progress bar in the terminal header."),
  notifications: z
    .object({
      unread_badge: z
        .boolean()
        .optional()
        .describe(
          "Show an unread badge on a terminal's tab when a notification-worthy event occurs while it isn't focused.",
        ),
      osc9: z
        .object({
          enabled: z
            .boolean()
            .optional()
            .describe("Allow OSC9 terminal notifications to trigger a notification."),
        })
        .optional()
        .describe("Notifications a program sends itself via the OSC 9 escape sequence."),
      long_running_command: z
        .object({
          enabled: z
            .boolean()
            .optional()
            .describe("Show a notification after a long-running command has finished."),
          minimum_duration_seconds: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Notify only when a command ran for at least this many seconds."),
        })
        .optional()
        .describe("Notification when a command that ran for a while finishes."),
    })
    .optional()
    .describe("Which terminal events raise a notification."),
  history: z
    .object({
      max_entries: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          "Maximum number of commands to keep per shell context in the command history log. Older entries beyond this count are pruned. 0 or unset means unlimited.",
        ),
      ignore_commands_with_leading_space: z
        .boolean()
        .optional()
        .describe(
          "Don't add a command to history if it was typed with a leading space, matching the HISTCONTROL=ignorespace convention used by bash/zsh.",
        ),
      import_shell_history: z
        .boolean()
        .optional()
        .describe(
          "On first launch with an empty history, import commands from the native shell history file (bash/gitbash: ~/.bash_history, zsh: ~/.zsh_history, powershell: PSReadLine ConsoleHost_history.txt).",
        ),
      auto_execute: z
        .boolean()
        .optional()
        .describe(
          "When enabled, selecting a history entry immediately executes the command. When disabled (default), the entry is written to the input line and must be confirmed with Enter.",
        ),
    })
    .optional()
    .describe("The recorded command history behind autocomplete and the history panel."),
  restore: z
    .object({
      enabled: z
        .boolean()
        .optional()
        .describe(
          "Restore workspaces, tabs, panes and terminal scrollback on the next launch, auto-saved on idle, workspace switch and exit. When off, nothing is persisted and each launch starts fresh; the explicit workspace save controls apply instead.",
        ),
      scrollback: z
        .boolean()
        .optional()
        .describe(
          "Include the terminal scrollback in the restored session, above a separator line. When off, the layout is restored but terminals start empty.",
        ),
      max_lines: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          "Maximum scrollback lines captured per terminal for restore. Caps the stored size; 0 means no scrollback.",
        ),
    })
    .optional()
    .describe("Session restore: bring workspaces, tabs and scrollback back on the next launch."),
});
