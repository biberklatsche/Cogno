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
  max_notifications_in_overview: z.number().int().min(0).optional(),
  app: z
    .object({
      available: z.boolean().optional(),
      enabled: z.boolean().optional(),
      notification_duration_seconds: z.number().int().min(0).optional(),
    })
    .optional(),
  os: z
    .object({
      available: z.boolean().optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
  telegram: z
    .object({
      available: z.boolean().optional(),
      enabled: z.boolean().optional(),
      bot_token: z.string().min(1).optional(),
      chat_id: z.union([z.string().min(1), z.number().int()]).transform(value => String(value)).optional(),
      forward_notifications: z.boolean().optional(),
      forward_replies_to_terminal: z.boolean().optional(),
    })
    .optional(),
  mark_terminal_on_notification: z.boolean().optional(),
  mark_terminal: z.boolean().optional(),
  app_notification_duration_seconds: z.number().int().min(0).optional(),
  max_notifications: z.number().int().min(0).optional(),
});

export const FeatureCommandPaletteSchema = z.object({
  mode: FeatureModeEnum.optional(),
});

export const FeatureTerminalSchema = z.object({
  progress_bar: z
    .object({
      enabled: z.boolean().optional().describe("Show the progress bar in the terminal header."),
    })
    .optional(),
});

export const FeatureTerminalSearchSchema = z.object({
  mode: FeatureModeEnum.optional(),
  match_background_color: HexColorSchema.optional(),
  match_border_color: HexColorSchema.optional(),
  match_overview_ruler_color: HexColorSchema.optional(),
  active_match_background_color: HexColorSchema.optional(),
  active_match_border_color: HexColorSchema.optional(),
  active_match_overview_ruler_color: HexColorSchema.optional(),
});
