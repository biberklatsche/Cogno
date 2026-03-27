import { z } from "zod";
import { FeatureModeContract } from "@cogno/core-sdk";

const HexColorSchema = z
  .string()
  .regex(
    /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    "Must be a 4-, 6-, or 8-digit hex color",
  );

const FeatureModeEnum = z.enum(["off", "hidden", "visible"] satisfies ReadonlyArray<FeatureModeContract>);

export const FeatureWorkspaceSchema = z.object({
  mode: FeatureModeEnum.optional(),
});

export const FeatureNotificationSchema = z.object({
  mode: FeatureModeEnum.optional(),
  highlight_terminal_on_activity: z.boolean().optional(),
  exceptions: z
    .object({
      handled: z
        .object({
          enabled: z
            .boolean()
            .optional()
            .describe("Show a notification for handled exceptions reported through the central error reporter."),
        })
        .optional(),
      unhandled: z
        .object({
          enabled: z
            .boolean()
            .optional()
            .describe("Show a notification for unhandled renderer exceptions caught by the global error reporter."),
        })
        .optional(),
    })
    .optional(),
  long_running_commands: z
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
  overview: z
    .object({
      max_items: z.number().int().min(0).optional(),
    })
    .optional(),
});

export const FeatureNotificationsSchema = z.object({
  app: z
    .object({
      available: z.boolean().optional(),
      enabled: z.boolean().optional(),
      duration_seconds: z.number().int().min(0).optional(),
    })
    .optional(),
  os: z
    .object({
      available: z.boolean().optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
});

export const FeatureCommandPaletteSchema = z.object({
  mode: FeatureModeEnum.optional(),
});

export const FeatureTerminalSchema = z.object({
  webgl: z.boolean().optional(),
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
});

export const FeatureSearchSchema = z.object({
  mode: FeatureModeEnum.optional(),
  match: z
    .object({
      background_color: HexColorSchema.optional(),
      border_color: HexColorSchema.optional(),
      overview_ruler_color: HexColorSchema.optional(),
    })
    .optional(),
  active_match: z
    .object({
      background_color: HexColorSchema.optional(),
      border_color: HexColorSchema.optional(),
      overview_ruler_color: HexColorSchema.optional(),
    })
    .optional(),
});
