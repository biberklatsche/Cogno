import { hexColorSchema } from "@cogno/core-api";
import { z } from "zod";

const decorationColorSchema = z.object({
  background: hexColorSchema.optional(),
  border: hexColorSchema.optional(),
  overview_ruler: hexColorSchema.optional(),
});

export const TerminalSettingsSchema = z.object({
  webgl: z.boolean().optional(),
  decoration: z
    .object({
      color: decorationColorSchema
        .optional()
        .describe("Highlight colors for decorated terminal content, e.g. search matches."),
      active_color: decorationColorSchema
        .optional()
        .describe("Highlight colors for the currently active decorated item."),
    })
    .optional(),
  inactive_overlay_opacity: z
    .number()
    .int()
    .min(0, "Opacity must be at least 0")
    .max(100, "Opacity must be at most 100")
    .optional(),
  ignore_bracketed_paste_mode: z.boolean().optional(),
  minimum_contrast_ratio: z.number().optional(),
  screen_reader_mode: z.boolean().optional(),
  allow_transparency: z.boolean().optional(),
  tab_stop_width: z.number().optional(),
  word_separator: z.string().optional(),
  progress_bar: z
    .object({
      enabled: z.boolean().optional().describe("Show the progress bar in the terminal header."),
    })
    .optional(),
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
        .optional(),
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
        .optional(),
    })
    .optional(),
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
    .optional(),
});
