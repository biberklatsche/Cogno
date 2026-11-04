import { TerminalId, TerminalPlacement } from "@cogno/shared/domain";
import { Observable } from "rxjs";

export type { TerminalPlacement };

/**
 * Read counterpart of `TerminalNavigator`: a feature asks where a terminal is
 * instead of asking to go there. `changes$` fires whenever a placement or the
 * order of workspaces/tabs may have changed, so a consumer re-reads.
 */
export abstract class TerminalPlacementPort {
  abstract getPlacement(terminalId: TerminalId): TerminalPlacement | undefined;
  abstract readonly changes$: Observable<void>;
}
