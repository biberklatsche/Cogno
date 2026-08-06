import { ShellPathAdapterDefinitionContract } from "./shell-path-adapter-definition.contract";
import { ShellSupportDefinitionContract } from "./shell-support.contract";

export const SHELL_LINE_EDITOR_ACTIONS = [
  "clearLine",
  "clearLineToEnd",
  "clearLineToStart",
  "deletePreviousWord",
  "deleteNextWord",
  "deleteSelection",
  "goToNextWord",
  "goToPreviousWord",
  "goToStartOfLine",
  "goToEndOfLine",
  "replaceCurrentInput",
  "selectTextRight",
  "selectTextLeft",
  "selectWordRight",
  "selectWordLeft",
  "selectTextToEndOfLine",
  "selectTextToStartOfLine",
  "selectAll",
] as const;

export type ShellLineEditorActionContract = (typeof SHELL_LINE_EDITOR_ACTIONS)[number];

/**
 * Capabilities one concrete shell session reported via the capability
 * handshake (OSC `COGNO:CAPS`, emitted when the integration script loads).
 * The static shell definition describes what an integration could support;
 * whether a capability is actually available (shell version, PSReadLine
 * present, platform) is only known to the running session, so native paths
 * must be gated on this report and never assumed statically.
 */
export interface ShellSessionCapabilitiesContract {
  readonly shellVersion?: string;
  /** Line-editor actions the session's integration executes natively. */
  readonly nativeActions: ReadonlyArray<ShellLineEditorActionContract>;
  /** Whether the session's line editor understands bracketed paste. */
  readonly bracketedPaste: boolean;
  /**
   * Set when the session runs on the degraded fallback (e.g. "bash-version"
   * for bash < 4.0, which is below Cogno's support policy).
   */
  readonly degradedReason?: string;
}

/**
 * Shell-specific preparation of text that is inserted into the shell's edit
 * buffer (autocomplete, history recall, paste-over-selection). Owned by the
 * shell definition so quoting and line-continuation semantics live next to
 * the shell they describe.
 */
export interface ShellInsertSanitizerContract {
  /**
   * Rewrites the text so it can be inserted into the edit buffer (e.g.
   * removing line continuations the shell itself would remove), mapping the
   * cursor index through the rewrite.
   */
  prepareInsert(text: string, cursorIndex: number): { text: string; cursorIndex: number };
  /**
   * Wraps the prepared text for a raw pty write (e.g. bracketed paste, so
   * remaining newlines are inserted literally instead of submitting lines).
   */
  wrapForPtyWrite(text: string): string;
}

export interface ShellLineEditorDefinitionContract {
  readonly nativeInputByAction?: Readonly<Partial<Record<ShellLineEditorActionContract, string>>>;
  readonly nativeActionsViaShellIntegration?: ReadonlyArray<ShellLineEditorActionContract>;
  readonly insertSanitizer?: ShellInsertSanitizerContract;
}

export interface ShellDefinitionContract {
  readonly support: ShellSupportDefinitionContract;
  readonly pathAdapter: ShellPathAdapterDefinitionContract;
  readonly lineEditor?: ShellLineEditorDefinitionContract;
}
