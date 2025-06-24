import {FontWeight} from '@xterm/xterm';
import {Shortcuts} from './shortcuts';

export type Settings = {
  themes: Theme[];
  shells: ShellConfig[];
  remoteShells: RemoteShellConfig[];
  autocomplete: AutocompleteConfig;
  shortcuts: Shortcuts;
  general: GeneralConfig;
  masterPasswordChecksum?: number;
}

export type GeneralConfig = {
  enableCopyOnSelect: boolean;
  openTabInSameDirectory: boolean;
  enableTelemetry: boolean;
  enablePasteOnRightClick: boolean;
  scrollbackLines: number;
  editor: EditorConfig;
}

export type EditorConfig = {
  editorCommand: string,
  editorArgs: string[],
  useCustomEditor: boolean,
}

export type Theme = HasName & {
  removeFullScreenAppPadding?: boolean;
  terminalSexyId?: string;
  isInstalled?: boolean;
  author?: string;
  fontsize: number;
  appFontsize: number;
  appFontFamily: string;
  fontFamily: string;
  cursorWidth?: number;
  cursorBlink?: boolean;
  cursorStyle?: 'underline' | 'bar';
  fontWeight?: FontWeight;
  fontWeightBold?: FontWeight;
  colors: Colors;
  image?: string;
  imageOpacity?: number;
  imageBlur?: number;
  padding: string;
  paddingAsArray: number[];
  prompt: string;
  promptVersion?: number;
  enableLigatures?: boolean;
  enableWebgl?: boolean;
  isDarkModeTheme?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
}

export type HasName = {
  name: string;
}

export type Colors = {
  /** The default foreground color */
  foreground: string;
  /** The default background color */
  background: string;
  /** The hightlight color */
  highlight: string;
  /** The cursor color */
  cursor?: string;
  /** ANSI black (eg. `\x1b[30m`) */
  black?: string;
  /** ANSI red (eg. `\x1b[31m`) */
  red?: string;
  /** ANSI green (eg. `\x1b[32m`) */
  green?: string;
  /** ANSI yellow (eg. `\x1b[33m`) */
  yellow?: string;
  /** ANSI blue (eg. `\x1b[34m`) */
  blue?: string;
  /** ANSI magenta (eg. `\x1b[35m`) */
  magenta?: string;
  /** ANSI cyan (eg. `\x1b[36m`) */
  cyan?: string;
  /** ANSI white (eg. `\x1b[37m`) */
  white?: string;
  /** ANSI bright black (eg. `\x1b[1;30m`) */
  brightBlack?: string;
  /** ANSI bright red (eg. `\x1b[1;31m`) */
  brightRed?: string;
  /** ANSI bright green (eg. `\x1b[1;32m`) */
  brightGreen?: string;
  /** ANSI bright yellow (eg. `\x1b[1;33m`) */
  brightYellow?: string;
  /** ANSI bright blue (eg. `\x1b[1;34m`) */
  brightBlue?: string;
  /** ANSI bright magenta (eg. `\x1b[1;35m`) */
  brightMagenta?: string;
  /** ANSI bright cyan (eg. `\x1b[1;36m`) */
  brightCyan?: string;
  /** ANSI bright white (eg. `\x1b[1;37m`) */
  brightWhite?: string;

  commandRunning?: string;
  commandSuccess?: string;
  commandError?: string;

  promptColors: [{foreground: 'cyan', background: 'black'}, {foreground: 'cyan', background: 'black'}]
}

export type ColorName = keyof Exclude<Colors, 'promptColors' | 'commandError' | 'commandSuccess' | 'commandRunning'>;
export type InjectionType = 'Auto' | 'Manual' | 'Remote';
export type ShellType = 'Bash' | 'GitBash'| 'Powershell' | 'ZSH';

export type ShellConfig = HasName & {
  id?: string;
  path: string;
  type: ShellType;
  injectionType: InjectionType;
  default?: boolean;
  workingDir?: string;
  isSelected?: boolean;
  isDebugModeEnabled?: boolean;
  usesFinalSpacePromptTerminator?: boolean;
  promptTerminator?: string;
  args?: string[];

  isSubshell?: boolean;
  remoteType?: ShellType;
  remoteCommand?: string;
}

export type RemoteShellConfig = HasName & {
  id?: string;
  color?: string;
  shellType: ShellType;
  connectionCommand: string;
  machineName?: string;
  isDebugModeEnabled: boolean;
  password?: string;
  passwordInjectionTrigger?: string;
}

export type AutocompleteConfig = {
  ignore: string[];
  position: 'cursor' | 'line';
  mode: 'always' | 'shortcut';
}

export type WindowSettings = {
  isMaximized: boolean;
  isInBounds: boolean;
  bounds: Bounds;

}

export type Bounds = {
  width: number;
  height: number;
  x?: number;
  y?: number;
}
