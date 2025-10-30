import { z } from 'zod'
import {OS, OsType} from "../../_tauri/os";

const HexColorSchema = z
    .string()
    .regex(/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/, 'Must be a valid 4-, 6-, or 8-digit hex color');

const PaddingValueSchema = z.string().regex(
    /^(\d+)(px|rem|%|em|pt)$/,
    'Padding must be a integer followed by a unit (px|rem|%|em|pt)');

const PaddingSchema = z.object({
    left: PaddingValueSchema,
    right: PaddingValueSchema,
    top: PaddingValueSchema,
    bottom: PaddingValueSchema,
    remove_on_full_screen_app: z.boolean(),
});

export const FontWeightSchema = z.union([
    z.enum([
        "normal",
        "bold",
        "100",
        "200",
        "300",
        "400",
        "500",
        "600",
        "700",
        "800",
        "900",
    ]),
    z.number(),
]);

export const FontSchema = z.object({
    family: z.string(),
    size: z.int().min(1, 'Font size must be at least 1').default(14),
    enable_ligatures: z.boolean().default(false),
    weight: FontWeightSchema.default('normal'),
    weight_bold: FontWeightSchema.default('bold'),
});

export const ColorsSchema = z.object({
    foreground: HexColorSchema,
    background: HexColorSchema,
    highlight: HexColorSchema,
    black: HexColorSchema,
    red: HexColorSchema,
    green: HexColorSchema,
    yellow: HexColorSchema,
    blue: HexColorSchema,
    magenta: HexColorSchema,
    cyan: HexColorSchema,
    white: HexColorSchema,
    bright_black: HexColorSchema,
    bright_red: HexColorSchema,
    bright_green: HexColorSchema,
    bright_yellow: HexColorSchema,
    bright_blue: HexColorSchema,
    bright_magenta: HexColorSchema,
    bright_cyan: HexColorSchema,
    bright_white: HexColorSchema,
});

export const CursorSchema = z.object({
    width: z.int().min(0, 'Cursor-With must be at least 0').max(10, 'Cursor-With must be at most 10'),
    blink: z.boolean(),
    style: z
        .enum(['bar', 'underline'])
        .refine((val) => ['bar', 'underscore'].includes(val), {
            message: 'Cursor style must be either "bar" or "underscore"',
        }),
    color: HexColorSchema,
})

export const ImageSchema = z.object({
    path: z.string(),
    opacity: z.int().min(0, 'Opacity must be at least 0').max(100, 'Opacity must be at most 100'),
    blur: z.int().min(0, 'Blur must be at least 0').max(10, 'Blur must be at most 10'),
});

const KeybindSchema = z.string().regex(
    /^(?:(?:all|unconsumed|performable):)*[^=\s]+=[a-zA-Z0-9_]+(?::[a-zA-Z0-9_]+)*$/,
    "Keybind must be of the form [triggers:]key[>key...]=action[:arg...]"
);

const KeybindsSchema = z.array(KeybindSchema);

const ShellTypeEnum = z.enum(["Powershell", "ZSH", "Bash", "GitBash"]);

const ShellSchema = z.object({
    shell_type: ShellTypeEnum,
    path: z.string(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
    use_conpty: z.boolean().optional(),
    working_dir: z.string().optional(),
}).describe("The shell configuration");

const ShellListSchema = z.object({
    1: ShellSchema.optional(),
    2: ShellSchema.optional(),
    3: ShellSchema.optional(),
    4: ShellSchema.optional(),
    5: ShellSchema.optional(),
    6: ShellSchema.optional(),
    7: ShellSchema.optional(),
    8: ShellSchema.optional(),
    9: ShellSchema.optional(),
    10: ShellSchema.optional(),
    11: ShellSchema.optional(),
    12: ShellSchema.optional(),
    13: ShellSchema.optional(),
    14: ShellSchema.optional(),
    15: ShellSchema.optional(),
    16: ShellSchema.optional(),
    17: ShellSchema.optional(),
    18: ShellSchema.optional(),
    19: ShellSchema.optional(),
    20: ShellSchema.optional()
});

/**
 * Single Source of Truth: Alle Defaults leben im Schema.
 * Zod füllt fehlende Werte automatisch über .default(...) auf.
 */
export const ConfigSchema = z.object({
    keybind: z.preprocess(
        (v) => (v == null ? pickDefaultKeybinds(OS.platform()) : v),
        KeybindsSchema
    ),
    scrollback_lines: z
    .number()
    .int()
    .min(100, "Scrollback lines must be at least 100")
    .max(1_000_000, "Scrollback lines must not exceed 1,000,000"),
    enable_webgl: z.boolean(),
    font: FontSchema,
    color: ColorsSchema,
    cursor: CursorSchema,
    padding: PaddingSchema,
    background_image: ImageSchema,
    shell: ShellListSchema.optional(),



}).strict();

export type Config = z.infer<typeof ConfigSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type ShellConfig = z.infer<typeof ShellSchema>;
export type ShellConfigPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
export type ShellType = z.infer<typeof ShellTypeEnum>;
export type RemoteInjectionType = z.infer<typeof RemoteInjectionTypeEnum>;

/** Bequemer Zugriff auf die reinen Defaults (abgeleitet aus dem Schema). */
export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
