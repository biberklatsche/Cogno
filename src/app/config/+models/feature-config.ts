import {z} from 'zod';
import {FeatureModeEnum} from "./shared";

export const FeatureWorkspaceSchema = z.object({
    mode: FeatureModeEnum.optional(),
});

export const FeatureInspectorSchema = z.object({
    mode: FeatureModeEnum.optional(),
});

export const FeatureNotificationSchema = z.object({
    mode: FeatureModeEnum.optional(),
});

export const FeatureCommandPaletteSchema = z.object({
    mode: FeatureModeEnum.optional(),
});
