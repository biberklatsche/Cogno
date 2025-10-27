import { z } from 'zod'
import {OS, OsType} from "../../_tauri/os";

const HexColorSchema = z
    .string()
    .regex(/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/, 'Must be a valid 4-, 6-, or 8-digit hex color');


const PaddingSchema = z.object({
    value: z.string().regex(
        /^(\d+)(\s+\d+){0,3}$/,
        'Padding must contain 1–4 integers separated by whitespace').default('1'),
    remove_on_full_screen_app: z.boolean().default(true),
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

const BaseFontSchema = z.object({
    family: z.string(),
    size: z.int().min(1, 'Font size must be at least 1').default(14),
    enable_ligatures: z.boolean().default(false),
    weight: FontWeightSchema.default('normal'),
    weight_bold: FontWeightSchema.default('bold'),
})

export const TerminalFontSchema = BaseFontSchema.extend({
    family: z.string().default('monospace'),
});

export const AppFontSchema = BaseFontSchema.extend({
    family: z.string().default('Roboto'),
});

const PromptColorNameSchema = z.enum([
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'brightBlack',
    'brightRed',
    'brightGreen',
    'brightYellow',
    'brightBlue',
    'brightMagenta',
    'brightCyan',
    'brightWhite',
]);

export const PromptColorSchema = z.object({
    foreground: PromptColorNameSchema,
    background: PromptColorNameSchema,
});

export const PromptColorListSchema = z.object({
    1: PromptColorSchema.default({
            foreground: 'blue',
            background: 'black'
        }),
    2: PromptColorSchema.default({
        foreground: 'cyan',
        background: 'black'
    }),
    3: PromptColorSchema.default({
        foreground: 'green',
        background: 'black'
    }),
    4: PromptColorSchema.default({
        foreground: 'yellow',
        background: 'black'
    }),
    5: PromptColorSchema.default({
        foreground: 'magenta',
        background: 'black'
    }),
    6: PromptColorSchema.default({
        foreground: 'red',
        background: 'black'
    })
});

export const ColorsSchema = z.object({
    foreground: HexColorSchema.default('#ffffff'),
    background: HexColorSchema.default('#0e1925'),
    highlight: HexColorSchema.default('#34bbfe'),
    black: HexColorSchema.default('#32465c'),
    red: HexColorSchema.default('#fd1155'),
    green: HexColorSchema.default('#11d894'),
    yellow: HexColorSchema.default('#fede55'),
    blue: HexColorSchema.default('#34bbfe'),
    magenta: HexColorSchema.default('#e465d9'),
    cyan: HexColorSchema.default('#32d8c1'),
    white: HexColorSchema.default('#eeeeee'),
    bright_black: HexColorSchema.default('#32465c'),
    bright_red: HexColorSchema.default('#fd1155'),
    bright_green: HexColorSchema.default('#11d894'),
    bright_yellow: HexColorSchema.default('#fede55'),
    bright_blue: HexColorSchema.default('#34bbfe'),
    bright_magenta: HexColorSchema.default('#e465d9'),
    bright_cyan: HexColorSchema.default('#32d8c1'),
    bright_white: HexColorSchema.default('#eeeeee'),
    cursor: HexColorSchema.default('#34bbfe'),
    command_running: HexColorSchema.default('#34bbfe'),
    command_success: HexColorSchema.default('#11d894'),
    command_error: HexColorSchema.default('#fd1155'),
    prompt: PromptColorListSchema.default(PromptColorListSchema.parse({})),
});

export const CursorSchema = z.object({
    width: z.int().min(0, 'Cursor-With must be at least 0').max(10, 'Cursor-With must be at most 10').default(4),
    blink: z.boolean().default(true),
    style: z
        .enum(['bar', 'underline'])
        .refine((val) => ['bar', 'underscore'].includes(val), {
            message: 'Cursor style must be either "bar" or "underscore"',
        }).default('bar')
})

export const ImageSchema = z.object({
    path: z.string(),
    opacity: z.int().min(0, 'Opacity must be at least 0').max(100, 'Opacity must be at most 100').default(80),
    blur: z.int().min(0, 'Blur must be at least 0').max(10, 'Blur must be at most 10').default(0),
});

const ThemeSchema = z.object({
    terminal_font: TerminalFontSchema.default(TerminalFontSchema.parse({})),
    app_font: AppFontSchema.default(AppFontSchema.parse({})),
    image: ImageSchema.optional(),
    padding: PaddingSchema.default(PaddingSchema.parse({})),
    color: ColorsSchema.default(ColorsSchema.parse({})),
    cursor: CursorSchema.default(CursorSchema.parse({})),
    enable_webgl: z.boolean().default(false),
});

const GeneralSchema = z.object({
    enable_telemetry: z.boolean().default(true).describe("Test tests \n test test"),
    enable_paste_on_right_click: z.boolean().default(false),
    enable_copy_on_select: z.boolean().default(false),
    open_tab_in_same_directory: z.boolean().default(true),
    enable_bracket_paste: z.boolean().default(true),
    scrollback_lines: z
        .number()
        .int()
        .min(100, "Scrollback lines must be at least 100")
        .max(1_000_000, "Scrollback lines must not exceed 1,000,000")
        .default(10000),
    editor: z.object({
        use_custom_editor: z.boolean().default(false),
        editor_command: z.string().default(""),
        editor_args: z.array(z.string()).default([]),
    }).optional(),
    master_password_checksum: z.string().optional()
});

const AutocompleteSchema = z.object({
    ignore: z
        .array(z.string())
        .default(["cd ..", "cd .", "cd ~", "cd /"]),
    position: z.enum(["cursor", "line"]).default("cursor"),
    mode: z.enum(["always", "manual", "never"]).default("always"),
});

const KeybindSchema = z.string().regex(
    /^(?:(?:Command|Control|Ctrl|Alt|Option|Shift|Meta)\+)+.+:[a-zA-Z0-9_]+$/,
    "Keybind must be in the format Command+Key:action"
);

const KeybindsSchema = z.array(KeybindSchema);
export type Keybinds = z.infer<typeof KeybindsSchema>;

export const DEFAULT_MAC_KEYBINDS: Keybinds = [
    'Command+P:show_actions',
    'Command+F1:bring_to_front',
    'Command+Tab:change_tab',
    'Alt+Right:next_tab',
    'Alt+Left:previous_tab',
    'Command+Alt+C:clear_buffer',
    'Command+W:close_tab',
    'Command+Shift+W:close_other_tabs',
    'Control+Shift+Q:close_all_tabs',
    'Command+Shift+<:split_vertical',
    'Command+Shift+-:split_horizontal',
    'Command+Shift+U:unsplit',
    'Command+Shift+P:swap_panes',
    'Control+C:abort_task',
    'Control+Shift+C:abort_all_tasks',
    'Command+C:copy',
    'Command+X:cut',
    'Command+F:find',
    'Control+Y:clear_line',
    'Control+M:clear_line_to_end',
    'Control+N:clear_line_to_start',
    'Control+,:delete_previous_word',
    'Control+.:delete_next_word',
    'Control+Right:go_to_next_word',
    'Control+Left:go_to_previous_word',
    'Command+T:new_tab',
    'Command+Shift+D:duplicate_tab',
    'Command+V:paste',
    'Control+Space:show_autocompletion',
    'Command+Shift+H:show_paste_history',
    'Control+K:show_key_tips',
    'Control+Shift+K:show_context_key_tips',
    'Control+Alt+Right:next_argument',
    'Control+Alt+Left:previous_argument',
    'Command+Shift+S:open_settings',
    'Command+1:open_shell_1',
    'Command+2:open_shell_2',
    'Command+3:open_shell_3',
    'Command+4:open_shell_4',
    'Command+5:open_shell_5',
    'Command+6:open_shell_6',
    'Command+7:open_shell_7',
    'Command+8:open_shell_8',
    'Command+9:open_shell_9',
    'Control+Shift+Up:scroll_to_previous_command',
    'Control+Shift+Down:scroll_to_next_command',
    'Control+Alt+Up:scroll_to_previous_bookmark',
    'Control+Alt+Down:scroll_to_next_bookmark',
    'Shift+Right:select_text_right',
    'Shift+Left:select_text_left',
    'Control+Shift+Right:select_word_right',
    'Control+Shift+Left:select_word_left',
    'Shift+End:select_text_to_end_of_line',
    'Shift+Home:select_text_to_start_of_line',
    'Control+Shift+F12:open_dev_tools',
    'Control+Shift+F:inject_password'
];
export const DEFAULT_KEYBINDS: Keybinds = [
    'Control+P:show_actions',
    'Control+F1:bring_to_front',
    'Control+Tab:change_tab',
    'Alt+Right:next_tab',
    'Alt+Left:previous_tab',
    'Control+Alt+C:clear_buffer',
    'Control+W:close_tab',
    'Control+Shift+W:close_other_tabs',
    'Control+Shift+Q:close_all_tabs',
    'Control+Shift+<:split_vertical',
    'Control+Shift+-:split_horizontal',
    'Control+Shift+U:unsplit',
    'Control+Shift+P:swap_panes',
    'Control+C:abort_task',
    'Control+Shift+C:abort_all_tasks',
    'Control+C:copy',
    'Control+X:cut',
    'Control+F:find',
    'Control+Y:clear_line',
    'Control+M:clear_line_to_end',
    'Control+N:clear_line_to_start',
    'Control+,:delete_previous_word',
    'Control+.:delete_next_word',
    'Control+Right:go_to_next_word',
    'Control+Left:go_to_previous_word',
    'Control+T:new_tab',
    'Control+Shift+D:duplicate_tab',
    'Control+V:paste',
    'Control+Space:show_autocompletion',
    'Control+Shift+H:show_paste_history',
    'Control+K:show_key_tips',
    'Control+Shift+K:show_context_key_tips',
    'Control+Alt+Right:next_argument',
    'Control+Alt+Left:previous_argument',
    'Control+Shift+S:open_settings',
    'Control+1:open_shell_1',
    'Control+2:open_shell_2',
    'Control+3:open_shell_3',
    'Control+4:open_shell_4',
    'Control+5:open_shell_5',
    'Control+6:open_shell_6',
    'Control+7:open_shell_7',
    'Control+8:open_shell_8',
    'Control+9:open_shell_9',
    'Control+Shift+Up:scroll_to_previous_command',
    'Control+Shift+Down:scroll_to_next_command',
    'Control+Alt+Up:scroll_to_previous_bookmark',
    'Control+Alt+Down:scroll_to_next_bookmark',
    'Shift+Right:select_text_right',
    'Shift+Left:select_text_left',
    'Control+Shift+Right:select_word_right',
    'Control+Shift+Left:select_word_left',
    'Shift+End:select_text_to_end_of_line',
    'Shift+Home:select_text_to_start_of_line',
    'Control+Shift+F12:open_dev_tools',
    'Control+Shift+F:inject_password'
]

const pickDefaultKeybinds = (os: OsType): Keybinds =>
    os === "macos" ? DEFAULT_MAC_KEYBINDS : DEFAULT_KEYBINDS;

const ShellTypeEnum = z.enum(["Powershell", "ZSH", "Bash", "GitBash"]);
const RemoteInjectionTypeEnum = z.enum(["auto", "manual"]);
const PromptVersionEnum = z.enum(["manual", "version1", "version2"]);

const ShellSchema = z.object({
    name: z.string().describe("The name of the shell. This is used for display purposes."),
    shell_type: ShellTypeEnum,
    path: z.string(),
    args: z.array(z.string()).default([]),
    is_debug_mode_enabled: z.boolean().default(false),
    use_conpty: z.boolean().optional(),
    working_dir: z.string().optional(),
    start_timeout: z.number().int().min(0, "Timeout must be >= 0").default(100000),
    prompt_terminator: z.string().default("$"),
    prompt_version: PromptVersionEnum.default("version1"),
    uses_final_space_prompt_terminator: z.boolean().default(true),
    injection_type: RemoteInjectionTypeEnum.default("auto"),
    color: HexColorSchema.optional(),
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

const RemoteShellSchema = z.object({
    id: z.string(),
    is_debug_mode_enabled: z.boolean().default(false),
    name: z.string(),
    shell_type: ShellTypeEnum,
    connection_command: z.string(),
    color: HexColorSchema.optional(),
    machine_name: z.string(),
});

const RemoteShellListSchema = z.object({
    1: RemoteShellSchema.optional(),
    2: RemoteShellSchema.optional(),
    3: RemoteShellSchema.optional(),
    4: RemoteShellSchema.optional(),
    5: RemoteShellSchema.optional(),
    6: RemoteShellSchema.optional(),
    7: RemoteShellSchema.optional(),
    8: RemoteShellSchema.optional(),
    9: RemoteShellSchema.optional(),
    10: RemoteShellSchema.optional(),
    11: RemoteShellSchema.optional(),
    12: RemoteShellSchema.optional(),
    13: RemoteShellSchema.optional(),
    14: RemoteShellSchema.optional(),
    15: RemoteShellSchema.optional(),
    16: RemoteShellSchema.optional(),
    17: RemoteShellSchema.optional(),
    18: RemoteShellSchema.optional(),
    19: RemoteShellSchema.optional(),
    20: RemoteShellSchema.optional(),
})

/**
 * Single Source of Truth: Alle Defaults leben im Schema.
 * Zod füllt fehlende Werte automatisch über .default(...) auf.
 */
export const ConfigSchema = z.object({
    general: GeneralSchema.default(GeneralSchema.parse({})),
    autocomplete: AutocompleteSchema.default(AutocompleteSchema.parse({})),
    keybind: z.preprocess(
        (v) => (v == null ? pickDefaultKeybinds(OS.platform()) : v),
        KeybindsSchema
    ),
    shell: ShellListSchema.default(ShellListSchema.parse({})),
    remote_shell: RemoteShellListSchema.optional(),
    theme: z.object({
        default: ThemeSchema,
        nightly: ThemeSchema.optional(),
    }).default({
        default: ThemeSchema.parse({})
    }),
}).strict();

export type Config = z.infer<typeof ConfigSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type ShellConfig = z.infer<typeof ShellSchema>;
export type ShellConfigPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
export type ShellType = z.infer<typeof ShellTypeEnum>;
export type RemoteInjectionType = z.infer<typeof RemoteInjectionTypeEnum>;

/** Bequemer Zugriff auf die reinen Defaults (abgeleitet aus dem Schema). */
export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
