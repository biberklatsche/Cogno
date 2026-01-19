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

//hidden, auto, always

const FeatureModeEnum = z
    .enum(['off', 'hidden', 'visible'])
    .refine((val) => ['off', 'hidden', 'visible'].includes(val), {
        message: 'Feature mode must be either "off", "hidden" or "visible"',
    }).optional();

const FeatureWorkspaceSchema = z.object({
    mode: FeatureModeEnum.optional(),
});

const FeatureInspectorSchema = z.object({
    mode: FeatureModeEnum.optional(),
});

const FeatureNotificationSchema = z.object({
    mode: FeatureModeEnum.optional(),
});

const FeatureCommandPaletteSchema = z.object({
    mode: FeatureModeEnum.optional(),
});

const ScrollbarVisibilityEnum = z
    .enum(['hidden', 'auto', 'always'])
    .refine((val) => ['hidden', 'auto', 'always'].includes(val), {
        message: 'Scrollbar visibility must be either "hidden", "auto" or "always"',
    }).optional();

const ScrollbarSchema = z.object({
   visibility: ScrollbarVisibilityEnum.optional(),
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
    width: z.number().int().min(0, 'Cursor-With must be at least 0').max(10, 'Cursor-With must be at most 10').optional(),
    blink: z.boolean().optional(),
    style: z
        .enum(['bar', 'underline', 'block'])
        .optional(),
    inactive_style: z
        .enum(['outline', 'block', 'bar', 'underline', 'none'])
        .optional(),
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
    inject_path: z.boolean().optional().default(true),
    enable_shell_integration: z.boolean().optional().default(true),
}).describe("The shell configuration");

export const SHELL_CONFIG_POSITIONS = [
    1, 2, 3, 4, 5,
    6, 7, 8, 9, 10,
    11, 12, 13, 14, 15,
    16, 17, 18, 19, 20,
] as const;
export const MAX_SHELL_POSITION = SHELL_CONFIG_POSITIONS[SHELL_CONFIG_POSITIONS.length - 1];

export type ShellConfigPosition = typeof SHELL_CONFIG_POSITIONS[number];
type ShellConfigPosKey = `${ShellConfigPosition}`; // "1" | "2" | ... | "20"

const ShellListSchema = z.object(
    Object.fromEntries(
        SHELL_CONFIG_POSITIONS.map((n) => [String(n), ShellSchema.optional()])
    ) as Record<ShellConfigPosKey, ReturnType<typeof ShellSchema.optional>>
);

const MenuSchema = z.object({
    opacity: z.int().min(0, 'Opacity must be at least 0').max(100, 'Opacity must be at most 100').optional(),
});

export const ConfigSchema = z.object({
    keybind: KeybindsSchema.optional(),
    scrollback_lines: z
    .number()
    .int()
    .min(100, "Scrollback lines must be at least 100")
    .max(1_000_000, "Scrollback lines must not exceed 1,000,000").optional(),
    enable_webgl: z.boolean().optional(),
    enable_watch_config: z.boolean().optional(),
    alt_click_moves_cursor: z.boolean().optional(),
    convert_eol: z.boolean().optional(),
    custom_glyphs: z.boolean().optional(),
    draw_bold_text_in_bright_colors: z.boolean().optional(),
    fast_scroll_modifier: z.enum(['none', 'alt', 'ctrl', 'shift']).optional(),
    fast_scroll_sensitivity: z.number().optional(),
    ignore_bracketed_paste_mode: z.boolean().optional(),
    minimum_contrast_ratio: z.number().optional(),
    rescale_overlapping_glyphs: z.boolean().optional(),
    right_click_selects_word: z.boolean().optional(),
    screen_reader_mode: z.boolean().optional(),
    scroll_on_user_input: z.boolean().optional(),
    scroll_sensitivity: z.number().optional(),
    smooth_scroll_duration: z.number().optional(),
    allow_transparency: z.boolean().optional(),
    tab_stop_width: z.number().optional(),
    word_separator: z.string().optional(),
    font: FontSchema.optional(),
    color: ColorSchema.optional(),
    cursor: CursorSchema.optional(),
    padding: PaddingSchema.optional(),
    background_image: ImageSchema.optional(),
    shell: ShellListSchema.optional(),
    selection: SelectionSchema.optional(),
    menu: MenuSchema.optional(),
    scrollbar: ScrollbarSchema.optional(),
    overview_ruler_width: z.number().optional(),
    workspace: FeatureWorkspaceSchema.optional(),
    inspector: FeatureInspectorSchema.optional(),
    notification: FeatureNotificationSchema.optional(),
    command_palette: FeatureCommandPaletteSchema.optional(),
}).strict();

export type Config = z.infer<typeof ConfigSchema>;
export type Font = z.infer<typeof FontSchema>;
export type Color = z.infer<typeof ColorSchema>;
export type Cursor = z.infer<typeof CursorSchema>;
export type Padding = z.infer<typeof PaddingSchema>;
export type Selection = z.infer<typeof SelectionSchema>;
export type Keybinding = z.infer<typeof KeybindsSchema>;
export type HexColor = z.infer<typeof HexColorSchema>;
export type ShellConfig = z.infer<typeof ShellSchema>;
export type ShellType = z.infer<typeof ShellTypeEnum>;
export type FeatureMode = z.infer<typeof FeatureModeEnum>;
export type ScrollbarVisibility = z.infer<typeof ScrollbarVisibilityEnum>;
