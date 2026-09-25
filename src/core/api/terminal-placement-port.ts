import { TerminalId } from "@cogno/shared/domain";
import { Observable } from "rxjs";

/** Where a terminal sits in the workbench: which workspace, which tab, in display order. */
export type TerminalPlacement = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  /** Colour name of the workspace, the default one when it has none. */
  readonly workspaceColor: string;
  /** Index of the workspace in the workspace list, as the panel shows it. */
  readonly workspacePosition: number;
  /** The tab as its header shows it: the user's name for it, else its system title. */
  readonly tabTitle: string;
  /** Index of the tab in its workspace's tab bar. */
  readonly tabIndex: number;
};

/**
 * Read counterpart of `TerminalNavigator`: a feature asks where a terminal is
 * instead of asking to go there. `changes$` fires whenever a placement or the
 * order of workspaces/tabs may have changed, so a consumer re-reads.
 */
export abstract class TerminalPlacementPort {
  abstract getPlacement(terminalId: TerminalId): TerminalPlacement | undefined;
  abstract readonly changes$: Observable<void>;
}
