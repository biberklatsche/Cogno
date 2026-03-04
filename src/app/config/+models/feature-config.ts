import {z} from 'zod';
import {FeatureModeEnum, HexColorSchema} from "./shared";

export const NotificationDeliveryModeSchema = z.enum(['app', 'os', 'off']);
export type NotificationDeliveryMode = z.infer<typeof NotificationDeliveryModeSchema>;

export const FeatureWorkspaceSchema = z.object({
    mode: FeatureModeEnum.optional(),
});

export const FeatureNotificationSchema = z.object({
    mode: FeatureModeEnum.optional(),
    notification_type: NotificationDeliveryModeSchema.optional(),
    // deprecated: keep for backward compatibility with existing configs
    os_notification: z.union([z.boolean(), NotificationDeliveryModeSchema]).optional(),
    app_notification_duration_seconds: z.number().int().min(0).optional(),
    max_notifications: z.number().int().min(0).optional(),
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
