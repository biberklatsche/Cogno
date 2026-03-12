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
  | "replaceCurrentInput"
  | "selectTextRight"
  | "selectTextLeft"
  | "selectWordRight"
  | "selectWordLeft"
  | "selectTextToEndOfLine"
  | "selectTextToStartOfLine"
  | "selectAll";

export interface ShellLineEditorDefinitionContract {
  readonly nativeInputByAction?: Readonly<Partial<Record<ShellLineEditorActionContract, string>>>;
  readonly nativeActionsViaShellIntegration?: ReadonlyArray<ShellLineEditorActionContract>;
}

export interface ShellDefinitionContract {
  readonly support: ShellSupportDefinitionContract;
  readonly pathAdapter: ShellPathAdapterDefinitionContract;
  readonly lineEditor?: ShellLineEditorDefinitionContract;
}
