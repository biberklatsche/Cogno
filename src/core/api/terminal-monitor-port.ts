import { TerminalId } from "@cogno/shared/domain";
import { Observable } from "rxjs";

export type TerminalActivityEvent = { terminalId: TerminalId; isBusy: boolean };
export type TerminalCwdChangeEvent = { terminalId: TerminalId; cwd: string };

export abstract class TerminalMonitorPort {
  abstract readonly activity$: Observable<TerminalActivityEvent>;
  abstract readonly terminated$: Observable<TerminalId>;
  abstract readonly cwdChanges$: Observable<TerminalCwdChangeEvent>;
  abstract isTerminalActive(terminalId: TerminalId): boolean;
  abstract getCwd(terminalId: TerminalId): string | undefined;
  /**
   * A path as a program in the terminal names it - absolute, or relative to the
   * terminal's cwd - as a normalized Cogno path, read in the terminal's shell
   * context. Undefined when the terminal or its context is unknown (remote/ssh).
   */
  abstract resolvePath(terminalId: TerminalId, path: string): string | undefined;
}
