import { TabId } from "@cogno/core/workbench/grid-layout";
import { TerminalId } from "@cogno/shared/domain";

/**
 * What session-scoped services may ask about the layout. `GridListService`
 * answers; it also creates the sessions, so they depend on this instead of on
 * it - otherwise the two would import each other. Bound in bootstrap.
 */
export abstract class PaneLayoutLookup {
  abstract findWorkspaceIdentifierByTerminalId(terminalId: TerminalId): string | undefined;
  abstract findTabIdByTerminalId(terminalId: TerminalId): TabId | undefined;
  /** Whether `terminalId` is the maximized pane of the active workspace. */
  abstract isMaximized(terminalId: TerminalId): boolean;
}
