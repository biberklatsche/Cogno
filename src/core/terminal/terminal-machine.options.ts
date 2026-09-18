import type { FontWeight, ITheme } from "@xterm/xterm";
import type { ICursorStyle } from "./terminal-machine.state";

/**
 * What the machine needs to build a terminal, as plain values.
 *
 * The machine reads no configuration (ARCHITECTURE.md 2.1): whoever owns the
 * session reads the config and hands these in, and pushes them again when the
 * user changes something. Every field is optional because xterm has its own
 * defaults for all of them.
 */
export type TerminalMachineOptions = {
  readonly webgl?: boolean;
  readonly allowTransparency?: boolean;
  readonly ignoreBracketedPasteMode?: boolean;
  readonly minimumContrastRatio?: number;
  readonly screenReaderMode?: boolean;
  readonly tabStopWidth?: number;
  readonly wordSeparator?: string;

  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly fontWeight?: FontWeight;
  readonly fontWeightBold?: FontWeight;
  readonly customGlyphs?: boolean;
  readonly drawBoldTextInBrightColors?: boolean;
  readonly rescaleOverlappingGlyphs?: boolean;

  readonly scrollbackLines?: number;
  readonly scrollSensitivity?: number;
  readonly fastScrollSensitivity?: number;
  readonly scrollOnUserInput?: boolean;
  readonly smoothScrollDuration?: number;
  readonly overviewRulerWidth?: number;

  readonly altClickMovesCursor?: boolean;
  readonly rightClickSelectsWord?: boolean;

  readonly cursorWidth?: number;
  readonly cursorBlink?: boolean;
  readonly cursorStyle?: ICursorStyle;
  readonly cursorInactiveStyle?: "outline" | "block" | "bar" | "underline" | "none";

  /** Colours, ready to use - the machine does not know a config key. */
  readonly theme?: ITheme;
};
