import { z } from 'zod'
import {OS, OsType} from "../../_tauri/os";

const HexColorSchema = z
    .string()
    .regex(/^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/, 'Must be a 4-, 6-, or 8-digit hex color');

const PaddingValueSchema = z.number().min(0);

const PaddingSchema = z.object({
    left: PaddingValueSchema.optional(),
    right: PaddingValueSchema.optional(),
    top: PaddingValueSchema.optional(),
    bottom: PaddingValueSchema.optional(),
    remove_on_full_screen_app: z.boolean().optional(),
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

export const AppFontSchema = z.object({
    family: z.string().optional(),
    size: z.int().min(1, 'Font size must be at least 1').optional(),
})

export const FontSchema = z.object({
    family: z.string().optional(),
    size: z.int().min(1, 'Font size must be at least 1').optional(),
    enable_ligatures: z.boolean().optional(),
    weight: FontWeightSchema.optional(),
    weight_bold: FontWeightSchema.optional(),
    app: AppFontSchema.optional(),
});

export const ColorSchema = z.object({
    foreground: HexColorSchema.optional(),
    background: HexColorSchema.optional(),
    highlight: HexColorSchema.optional(),
    black: HexColorSchema.optional(),
    red: HexColorSchema.optional(),
    green: HexColorSchema.optional(),
    yellow: HexColorSchema.optional(),
    blue: HexColorSchema.optional(),
    magenta: HexColorSchema.optional(),
    cyan: HexColorSchema.optional(),
    white: HexColorSchema.optional(),
    bright_black: HexColorSchema.optional(),
    bright_red: HexColorSchema.optional(),
    bright_green: HexColorSchema.optional(),
    bright_yellow: HexColorSchema.optional(),
    bright_blue: HexColorSchema.optional(),
    bright_magenta: HexColorSchema.optional(),
    bright_cyan: HexColorSchema.optional(),
    bright_white: HexColorSchema.optional(),
});

export const CursorSchema = z.object({
    width: z.int().min(0, 'Cursor-With must be at least 0').max(10, 'Cursor-With must be at most 10').optional(),
    blink: z.boolean().optional(),
    style: z
        .enum(['bar', 'underline'])
        .refine((val) => ['bar', 'underscore'].includes(val), {
            message: 'Cursor style must be either "bar" or "underscore"',
        }).optional(),
    color: HexColorSchema.optional(),
})

export const SelectionSchema= z.object({
    clear_on_copy: z.boolean().optional(),
})

export const ImageSchema = z.object({
    path: z.string().optional(),
    opacity: z.int().min(0, 'Opacity must be at least 0').max(100, 'Opacity must be at most 100').optional(),
    blur: z.int().min(0, 'Blur must be at least 0').max(10, 'Blur must be at most 10').optional(),
});

const KeybindSchema = z.string().regex(
    /^[^\s=>]+(?:\+[^\s=>]+)*(?:>(?:[^\s=>]+(?:\+[^\s=>]+)*))*=(?:\[(?:all|unconsumed|performable)(?::(?:all|unconsumed|performable))*\])?[A-Za-z0-9_]+(?::[A-Za-z0-9_]+)*$/,
    "Keybind must be of the form combo[>combo...]=[triggers]action[:arg...]"
);

const KeybindsSchema = z.array(KeybindSchema);

const ShellTypeEnum = z.enum(["PowerShell", "ZSH", "Bash", "GitBash"]);

const ShellSchema = z.object({
    shell_type: ShellTypeEnum.optional(),
    path: z.string().optional(),
    args: z.array(z.string().optional()).optional(),
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

export const ConfigSchema = z.object({
    keybind: KeybindsSchema.optional(),
    scrollback_lines: z
    .number()
    .int()
    .min(100, "Scrollback lines must be at least 100")
    .max(1_000_000, "Scrollback lines must not exceed 1,000,000").optional(),
    enable_webgl: z.boolean().optional(),
    font: FontSchema.optional(),
    color: ColorSchema.optional(),
    cursor: CursorSchema.optional(),
    padding: PaddingSchema.optional(),
    background_image: ImageSchema.optional(),
    shell: ShellListSchema.optional(),
    selection: SelectionSchema.optional(),
}).strict();

export type ConfigTypes = z.infer<typeof ConfigSchema>;
export type Font = z.infer<typeof FontSchema>;
export type Color = z.infer<typeof ColorSchema>;
export type Cursor = z.infer<typeof CursorSchema>;
export type Padding = z.infer<typeof PaddingSchema>;
export type Selection = z.infer<typeof SelectionSchema>;
export type ShellConfig = z.infer<typeof ShellSchema>;
export type ShellConfigPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
export type ShellType = z.infer<typeof ShellTypeEnum>;
export type ActionName =
    'copy' |
    'paste' |
    'open_new_tab' |
    'close_active_tab' |
    'split_right' |
    'split_down' |
    'split_left' |
    'split_up' |
    'clear_buffer'
    ;
