import {z} from 'zod';

export const HexColorSchema = z
    .string()
    .regex(/^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Must be a 4-, 6-, or 8-digit hex color');

export type HexColor = z.infer<typeof HexColorSchema>;

export const FeatureModeEnum = z
    .enum(['off', 'hidden', 'visible'])
    .refine((val) => ['off', 'hidden', 'visible'].includes(val), {
        message: 'Feature mode must be either "off", "hidden" or "visible"',
    });

export type FeatureMode = z.infer<typeof FeatureModeEnum>;

export const TerminalNamedColorSchema = z.union([
    z.literal('black'),
    z.literal('red'),
    z.literal('green'),
    z.literal('yellow'),
    z.literal('blue'),
    z.literal('magenta'),
    z.literal('cyan'),
    z.literal('white'),
    z.literal('brightBlack'),
    z.literal('brightRed'),
    z.literal('brightGreen'),
    z.literal('brightYellow'),
    z.literal('brightBlue'),
    z.literal('brightMagenta'),
    z.literal('brightCyan'),
    z.literal('brightWhite'),
]);
