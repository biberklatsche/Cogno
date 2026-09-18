import { Config } from "@cogno/core/infrastructure/config/models/config";
import { TerminalMachineOptions } from "@cogno/core/terminal/terminal-machine.options";
import { toTerminalTheme } from "./terminal-theme.mapper";

/**
 * Reads the configuration for the machine, which reads none itself
 * (ARCHITECTURE.md 2.1, boundary decision 2). Whoever owns the session calls
 * this and hands the result in - and calls it again when the config changes.
 */
export function toTerminalMachineOptions(config: Config): TerminalMachineOptions {
  return {
    webgl: config.terminal?.webgl,
    allowTransparency: config.terminal?.allow_transparency,
    ignoreBracketedPasteMode: config.terminal?.ignore_bracketed_paste_mode,
    minimumContrastRatio: config.terminal?.minimum_contrast_ratio,
    screenReaderMode: config.terminal?.screen_reader_mode,
    tabStopWidth: config.terminal?.tab_stop_width,
    wordSeparator: config.terminal?.word_separator,

    fontFamily: config.font?.family,
    fontSize: config.font?.size,
    fontWeight: config.font?.weight,
    fontWeightBold: config.font?.weight_bold,
    customGlyphs: config.font?.custom_glyphs,
    drawBoldTextInBrightColors: config.font?.draw_bold_text_in_bright_colors,
    rescaleOverlappingGlyphs: config.font?.rescale_overlapping_glyphs,

    scrollbackLines: config.scrollbar?.scrollback_lines,
    scrollSensitivity: config.scrollbar?.sensitivity,
    fastScrollSensitivity: config.scrollbar?.fast_scroll_sensitivity,
    scrollOnUserInput: config.scrollbar?.scroll_on_user_input,
    smoothScrollDuration: config.scrollbar?.smooth_scroll_duration,
    overviewRulerWidth: config.scrollbar?.width,

    altClickMovesCursor: config.cursor?.alt_click_moves_cursor,
    rightClickSelectsWord: config.selection?.right_click_selects_word,

    cursorWidth: config.cursor?.width,
    cursorBlink: config.cursor?.blink,
    cursorStyle: config.cursor?.style,
    cursorInactiveStyle: config.cursor?.inactive_style,
    theme: toTerminalTheme(config),
  };
}
