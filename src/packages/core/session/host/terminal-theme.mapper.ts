import { Config } from "@cogno/core/infrastructure/config/models/config";
import type { ITheme } from "@xterm/xterm";

/**
 * Turns the configured colours into the palette the machine applies. The
 * machine knows colours, not config keys (ARCHITECTURE.md 2.1).
 */
export function toTerminalTheme(config: Config): ITheme {
  const color = config.color;
  const scrollbar = config.scrollbar;
  return {
    overviewRulerBorder: `#${scrollbar?.overview_ruler_border_color}`,
    scrollbarSliderBackground: `#${scrollbar?.slider_color}`,
    scrollbarSliderHoverBackground: `#${scrollbar?.slider_hover_color}`,
    scrollbarSliderActiveBackground: `#${scrollbar?.slider_active_color}`,

    background: config.terminal?.allow_transparency ? "#00000000" : `#${color?.background}`,
    cursor: `#${config.cursor?.color}`,
    cursorAccent: `#${config.cursor?.accent_color}`,
    foreground: `#${color?.foreground}`,
    selectionBackground: `#${color?.highlight}88`,
    selectionInactiveBackground: `#${color?.highlight}55`,
    black: `#${color?.black}`,
    red: `#${color?.red}`,
    green: `#${color?.green}`,
    yellow: `#${color?.yellow}`,
    blue: `#${color?.blue}`,
    magenta: `#${color?.magenta}`,
    cyan: `#${color?.cyan}`,
    white: `#${color?.bright_white}`,
    brightBlack: `#${color?.bright_black}`,
    brightRed: `#${color?.bright_red}`,
    brightGreen: `#${color?.bright_green}`,
    brightYellow: `#${color?.bright_yellow}`,
    brightBlue: `#${color?.bright_blue}`,
    brightMagenta: `#${color?.bright_magenta}`,
    brightCyan: `#${color?.bright_cyan}`,
    brightWhite: `#${color?.bright_white}`,
  };
}
