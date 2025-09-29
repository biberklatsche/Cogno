import { z } from 'zod'
import {OS, OsType} from "../../_tauri/os";

const HexColorSchema = z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid 6-digit hex color');


const PaddingSchema = z.object({
    value: z.string().regex(
        /^(\d+)(\s*,\s*\d+){0,3}$/,
        'Padding must contain 1–4 integers separated by commas').default('1'),
    removeOnFullScreenApp: z.boolean().default(true),
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
    enableLigatures: z.boolean().default(false),
    weight: FontWeightSchema.default('normal'),
    weightBold: FontWeightSchema.default('bold'),
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

export type PromptColorName = z.infer<typeof PromptColorNameSchema>;

export const PromptColorSchema = z.object({
    foreground: PromptColorNameSchema,
    background: PromptColorNameSchema,
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
    brightBlack: HexColorSchema.default('#32465c'),
    brightRed: HexColorSchema.default('#fd1155'),
    brightGreen: HexColorSchema.default('#11d894'),
    brightYellow: HexColorSchema.default('#fede55'),
    brightBlue: HexColorSchema.default('#34bbfe'),
    brightMagenta: HexColorSchema.default('#e465d9'),
    brightCyan: HexColorSchema.default('#32d8c1'),
    brightWhite: HexColorSchema.default('#eeeeee'),
    cursor: HexColorSchema.default('#34bbfe'),
    commandRunning: HexColorSchema.default('#34bbfe'),
    commandSuccess: HexColorSchema.default('#11d894'),
    commandError: HexColorSchema.default('#fd1155'),
    promptColors: z.array(PromptColorSchema).default([
        {
            foreground: 'blue',
            background: 'black'
        },
        {
            foreground: 'cyan',
            background: 'black'
        },
        {
            foreground: 'green',
            background: 'black'
        }]),
});

export const CursorSchema = z.object({
    width: z.int().min(0, 'Cursor-With must be at least 0').min(10, 'Cursor-With must be at most 10').default(4),
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
    terminalFont: TerminalFontSchema.default(TerminalFontSchema.parse({})),
    appFont: AppFontSchema.default(AppFontSchema.parse({})),
    image: ImageSchema.optional(),
    padding: PaddingSchema.default(PaddingSchema.parse({})),
    colors: ColorsSchema.default(ColorsSchema.parse({})),
    cursor: CursorSchema.default(CursorSchema.parse({})),
    enableWebgl: z.boolean().default(false),
});

const GeneralSchema = z.object({
    enableTelemetry: z.boolean().default(true),
    enablePasteOnRightClick: z.boolean().default(false),
    enableCopyOnSelect: z.boolean().default(false),
    openTabInSameDirectory: z.boolean().default(true),
    enableBracketPaste: z.boolean().default(true),
    scrollbackLines: z
        .number()
        .int()
        .min(0, "Scrollback lines must be at least 0")
        .max(1_000_000, "Scrollback lines must not exceed 1,000,000")
        .default(100000),
    editor: z.object({
        useCustomEditor: z.boolean().default(false),
        editorCommand: z.string().default(""),
        editorArgs: z.array(z.string()).default([]),
    }).optional(),
    masterPasswordChecksum: z.string().optional()
});

const AutocompleteSchema = z.object({
    ignore: z
        .array(z.string())
        .default(["cd ..", "cd .", "cd ~", "cd /"]),
    position: z.enum(["cursor", "line"]).default("cursor"),
    mode: z.enum(["always", "manual", "never"]).default("always"),
});

const AliasSchema = z.object({
    command: z.string(),
    shortcut: z.string(),
});

const ShortcutsSchema = z.object({
    aliases: z.array(AliasSchema).default([]),

    showActions: z.string(),
    bringToFront: z.string(),
    changeTab: z.string(),
    nextTab: z.string(),
    previousTab: z.string(),
    clearBuffer: z.string(),
    closeTab: z.string(),
    closeOtherTabs: z.string(),
    closeAllTabs: z.string(),
    splitVertical: z.string(),
    splitAndMoveVertical: z.string(),
    splitHorizontal: z.string(),
    splitAndMoveHorizontal: z.string(),
    unsplit: z.string(),
    swapPanes: z.string(),
    abortTask: z.string(),
    abortAllTasks: z.string(),
    copy: z.string(),
    cut: z.string(),
    find: z.string(),
    clearLine: z.string(),
    clearLineToEnd: z.string(),
    clearLineToStart: z.string(),
    deletePreviousWord: z.string(),
    deleteNextWord: z.string(),
    goToNextWord: z.string(),
    goToPreviousWord: z.string(),
    newTab: z.string(),
    duplicateTab: z.string(),
    paste: z.string(),
    showAutocompletion: z.string(),
    showPasteHistory: z.string(),
    showKeytips: z.string(),
    showContextKeytips: z.string(),
    nextArgument: z.string(),
    previousArgument: z.string(),
    openSettings: z.string(),
    openShell1: z.string(),
    openShell2: z.string(),
    openShell3: z.string(),
    openShell4: z.string(),
    openShell5: z.string(),
    openShell6: z.string(),
    openShell7: z.string(),
    openShell8: z.string(),
    openShell9: z.string(),
    scrollToPreviousCommand: z.string(),
    scrollToNextCommand: z.string(),
    scrollToPreviousBookmark: z.string(),
    scrollToNextBookmark: z.string(),
    selectTextRight: z.string(),
    selectTextLeft: z.string(),
    selectWordRight: z.string(),
    selectWordLeft: z.string(),
    selectTextToEndOfLine: z.string(),
    selectTextToStartOfLine: z.string(),
    openDevTools: z.string(),
    injectPassword: z.string(),
});

export type Shortcuts = z.infer<typeof ShortcutsSchema>;

export const DEFAULT_MAC_SHORTCUTS: Shortcuts = { aliases: [ { command: 'cd ..', shortcut: 'Control+U' } ], showActions: 'Command+P', bringToFront: 'Command+F1', changeTab: 'Command+Tab', nextTab: 'Alt+Right', previousTab: 'Alt+Left', clearBuffer: 'Command+Alt+C', closeTab: 'Command+W', closeOtherTabs: 'Command+Shift+W', closeAllTabs: 'Control+Shift+Q', splitVertical: 'Command+Shift+<', splitAndMoveVertical: 'Command+<', splitHorizontal: 'Command+Shift+-', splitAndMoveHorizontal: 'Command+-', unsplit: 'Command+Shift+U', swapPanes: 'Command+Shift+P', abortTask: 'Control+C', abortAllTasks: 'Control+Shift+C', copy: 'Command+C', cut: 'Command+X', find: 'Command+F', clearLine: 'Control+Y', clearLineToEnd: 'Control+M', clearLineToStart: 'Control+N', deletePreviousWord: 'Control+,', deleteNextWord: 'Control+.', goToNextWord: 'Control+Right', goToPreviousWord: 'Control+Left', newTab: 'Command+T', duplicateTab: 'Command+Shift+D', paste: 'Command+V', showAutocompletion: 'Control+Space', showPasteHistory: 'Command+Shift+H', showKeytips: 'Control+K', showContextKeytips: 'Control+Shift+K', nextArgument: 'Control+Alt+Right', previousArgument: 'Control+Alt+Left', openSettings: 'Command+Shift+S', openShell1: 'Command+1', openShell2: 'Command+2', openShell3: 'Command+3', openShell4: 'Command+4', openShell5: 'Command+5', openShell6: 'Command+6', openShell7: 'Command+7', openShell8: 'Command+8', openShell9: 'Command+9', scrollToPreviousCommand: 'Control+Shift+Up', scrollToNextCommand: 'Control+Shift+Down', scrollToPreviousBookmark: 'Control+Alt+Up', scrollToNextBookmark: 'Control+Alt+Down', selectTextRight: 'Shift+Right', selectTextLeft: 'Shift+Left', selectWordRight: 'Control+Shift+Right', selectWordLeft: 'Control+Shift+Left', selectTextToEndOfLine: 'Shift+End', selectTextToStartOfLine: 'Shift+Home', openDevTools: 'Control+Shift+F12', injectPassword: 'Control+Shift+F' };
export const DEFAULT_SHORTCUTS: Shortcuts = { aliases: [ { command: 'cd ..', shortcut: 'Control+U' } ], showActions: 'Control+P', bringToFront: 'Control+F1', changeTab: 'Control+Tab', nextTab: 'Alt+Right', previousTab: 'Alt+Left', clearBuffer: 'Control+Alt+C', closeTab: 'Control+W', closeOtherTabs: 'Control+Shift+W', closeAllTabs: 'Control+Shift+Q', splitVertical: 'Control+Shift+<', splitAndMoveVertical: 'Control+<', splitHorizontal: 'Control+Shift+-', splitAndMoveHorizontal: 'Control+-', unsplit: 'Control+Shift+U', swapPanes: 'Control+Shift+P', abortTask: 'Control+C', abortAllTasks: 'Control+Shift+C', copy: 'Control+C', cut: 'Control+X', find: 'Control+F', clearLine: 'Control+Y', clearLineToEnd: 'Control+M', clearLineToStart: 'Control+N', deletePreviousWord: 'Control+,', deleteNextWord: 'Control+.', goToNextWord: 'Control+Right', goToPreviousWord: 'Control+Left', newTab: 'Control+T', duplicateTab: 'Control+Shift+D', paste: 'Control+V', showAutocompletion: 'Control+Space', showPasteHistory: 'Control+Shift+H', showKeytips: 'Control+K', showContextKeytips: 'Control+Shift+K', nextArgument: 'Control+Alt+Right', previousArgument: 'Control+Alt+Left', openSettings: 'Control+Shift+S', openShell1: 'Control+1', openShell2: 'Control+2', openShell3: 'Control+3', openShell4: 'Control+4', openShell5: 'Control+5', openShell6: 'Control+6', openShell7: 'Control+7', openShell8: 'Control+8', openShell9: 'Control+9', scrollToPreviousCommand: 'Control+Shift+Up', scrollToNextCommand: 'Control+Shift+Down', scrollToPreviousBookmark: 'Control+Alt+Up', scrollToNextBookmark: 'Control+Alt+Down', selectTextRight: 'Shift+Right', selectTextLeft: 'Shift+Left', selectWordRight: 'Control+Shift+Right', selectWordLeft: 'Control+Shift+Left', selectTextToEndOfLine: 'Shift+End', selectTextToStartOfLine: 'Shift+Home', openDevTools: 'Control+Shift+F12', injectPassword: 'Control+Shift+F' }

const pickDefaultShortcuts = (os: OsType) =>
    os === "macos" ? DEFAULT_MAC_SHORTCUTS : DEFAULT_SHORTCUTS;

const pickDefaultShells = (os: OsType) => {
    const shells: ShellConfig[] = [];
    if (os === "windows") {
        shells.push({
            id: "7fbb90f5-9c3e-4b1e-99d1-978843daca1c",
            name: "Git Bash",
            shellType: "GitBash",
            promptVersion: "version1",
            path: "C:\\arbeit\\Git\\bin\\sh.exe",
            args: [
                "--login",
                "-i"
            ],
            default: true,
            useConpty: true,
            workingDir: "D:\\Projects",
            startTimeout: 100000,
            promptTerminator: "🖕",
            usesFinalSpacePromptTerminator: true,
            injectionType: "manual",
            isDebugModeEnabled: false
        })
    } else if (os === "macos") {
        shells.push({
            id: "7fbb90f5-9c3e-4b1e-99d1-978843daca1c",
            name: "ZSH",
            shellType: "ZSH",
            promptVersion: "version1",
            path: "/etc/zsh",
            args: [
                "--login",
                "-i"
            ],
            default: true,
            useConpty: true,
            workingDir: "/~",
            startTimeout: 100000,
            promptTerminator: "🖕",
            usesFinalSpacePromptTerminator: true,
            injectionType: "manual",
            isDebugModeEnabled: false
        })
    }
}

const ShellTypeEnum = z.enum(["Powershell", "ZSH", "Bash", "GitBash"]);
const RemoteInjectionTypeEnum = z.enum(["auto", "manual"]);
const PromptVersionEnum = z.enum(["manual", "version1", "version2"]);

const ShellSchema = z.object({
    id: z.string(),
    name: z.string(),
    shellType: ShellTypeEnum,
    path: z.string(),
    args: z.array(z.string()).default([]),
    default: z.boolean().default(false),
    isDebugModeEnabled: z.boolean().default(false),
    useConpty: z.boolean().default(true),
    workingDir: z.string().optional(),
    startTimeout: z.number().int().min(0, "Timeout must be >= 0").default(100000),
    promptTerminator: z.string().default("$"),
    promptVersion: PromptVersionEnum.default("version1"),
    usesFinalSpacePromptTerminator: z.boolean().default(true),
    injectionType: RemoteInjectionTypeEnum.default("auto"),
    color: HexColorSchema.optional(),
});

const ShellsSchema = z.array(ShellSchema).default([]);

const RemoteShellSchema = z.object({
    id: z.string(),
    isDebugModeEnabled: z.boolean().default(false),
    name: z.string(),
    shellType: ShellTypeEnum,
    connectionCommand: z.string(),
    color: HexColorSchema.optional(),
    machineName: z.string(),
});

const RemoteShellsSchema = z.array(RemoteShellSchema).default([]);

/**
 * Single Source of Truth: Alle Defaults leben im Schema.
 * Zod füllt fehlende Werte automatisch über .default(...) auf.
 */
export const SettingsSchema = z.object({
    general: GeneralSchema.default(GeneralSchema.parse({})),
    autocomplete: AutocompleteSchema.default(AutocompleteSchema.parse({})),
    shortcuts: z.preprocess(
        (v) => (v == null ? pickDefaultShortcuts(OS.platform()) : v),
        ShortcutsSchema
    ),
    shells: z.preprocess(
        (v) => (v == null ? pickDefaultShells(OS.platform()) : v),
        ShellsSchema
    ),
    remoteShells: RemoteShellsSchema.optional(),
    theme: z.object({
        default: ThemeSchema,
        nightly: ThemeSchema.optional(),
    }).default({
        default: ThemeSchema.parse({}),
        nightly: undefined,
    }),
}).strict();

export type Settings = z.infer<typeof SettingsSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type ShellConfig = z.infer<typeof ShellSchema>;
export type ShellType = z.infer<typeof ShellTypeEnum>;
export type RemoteInjectionType = z.infer<typeof RemoteInjectionTypeEnum>;

/** Bequemer Zugriff auf die reinen Defaults (abgeleitet aus dem Schema). */
export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});
