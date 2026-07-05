import { ShellPathAdapterDefinitionContract } from "./shell-path-adapter-definition.contract";
import { ShellSupportDefinitionContract } from "./shell-support.contract";

export type ShellLineEditorActionContract =
  | "clearLine"
  | "clearLineToEnd"
  | "clearLineToStart"
  | "deletePreviousWord"
  | "deleteNextWord"
  | "deleteSelection"
  | "goToNextWord"
  | "goToPreviousWord"
  | "goToStartOfLine"
  | "goToEndOfLine"
  | "replaceCurrentInput"
  | "selectTextRight"
  | "selectTextLeft"
  | "selectWordRight"
  | "selectWordLeft"
  | "selectTextToEndOfLine"
  | "selectTextToStartOfLine"
  | "selectAll";

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
