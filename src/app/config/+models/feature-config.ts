import {z} from 'zod';
import {FeatureModeEnum, HexColorSchema} from "./shared";

export const FeatureWorkspaceSchema = z.object({
    mode: FeatureModeEnum.optional(),
});

export const FeatureNotificationSchema = z.object({
    mode: FeatureModeEnum.optional(),
    os_notification: z.boolean().optional(),
});

export const FeatureCommandPaletteSchema = z.object({
    mode: FeatureModeEnum.optional(),
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
