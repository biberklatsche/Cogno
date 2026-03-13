import {z} from 'zod'
import {PromptConfigSchema} from "./prompt-config";
import {HexColor, HexColorSchema, FeatureMode} from "./shared";
import {Font, FontSchema} from "./font-config";
import {Color, ColorSchema} from "./color-config";
import {Cursor, CursorSchema} from "./cursor-config";
import {Padding, PaddingSchema} from "./padding-config";
import {ImageSchema} from "./image-config";
import {ShellConfig, ShellConfigSchema, ShellType} from "./shell-config";
import {Selection, SelectionSchema} from "./selection-config";
import {MenuSchema} from "./menu-config";
import {Scrollbar, ScrollbarSchema} from "./scrollbar-config";
import {
    FeatureCommandPaletteSchema,
    FeatureNotificationSchema,
    FeatureTerminalSchema,
    FeatureTerminalSearchSchema,
    FeatureWorkspaceSchema
} from "@cogno/features/feature-settings.schemas";
import {KeybindsSchema, Keybinding} from "./keybind-config";

export {HexColor, FeatureMode, Font, Color, Cursor, Padding, ShellConfig, ShellType, Selection, Scrollbar, Keybinding};

export const baseConfigSchemaShape = {
    keybind: KeybindsSchema.optional(),
    enable_webgl: z.boolean().optional(),
    enable_watch_config: z.boolean().optional(),

    inactive_overlay_opacity: z.number().int().min(0, 'Opacity must be at least 0').max(100, 'Opacity must be at most 100').optional(),
    ignore_bracketed_paste_mode: z.boolean().optional(),
    minimum_contrast_ratio: z.number().optional(),

    screen_reader_mode: z.boolean().optional(),
    allow_transparency: z.boolean().optional(),
    tab_stop_width: z.number().optional(),
    word_separator: z.string().optional(),
    font: FontSchema.optional(),
    color: ColorSchema.optional(),
    cursor: CursorSchema.optional(),
    padding: PaddingSchema.optional(),
    background_image: ImageSchema.optional(),
    shell: ShellConfigSchema.optional(),
    selection: SelectionSchema.optional(),
    menu: MenuSchema.optional(),
    scrollbar: ScrollbarSchema.optional(),
    prompt: PromptConfigSchema.optional(),
} satisfies z.ZodRawShape;

export const featureConfigSchemaShape = {
    workspace: FeatureWorkspaceSchema.optional(),
    notification: FeatureNotificationSchema.optional(),
    command_palette: FeatureCommandPaletteSchema.optional(),
    terminal: FeatureTerminalSchema.optional(),
    terminal_search: FeatureTerminalSearchSchema.optional(),
} satisfies z.ZodRawShape;

export const ConfigSchema = z.object({
    ...baseConfigSchemaShape,
    ...featureConfigSchemaShape,
}).strict();

export type Config = z.infer<typeof ConfigSchema> & Record<string, unknown>;
