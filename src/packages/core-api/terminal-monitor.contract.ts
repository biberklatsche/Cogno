import { Observable } from "rxjs";
import { TerminalId } from "./terminal-gateway.contract";

export type TerminalActivityEvent = { terminalId: TerminalId; isBusy: boolean };
export type TerminalCwdChangeEvent = { terminalId: TerminalId; cwd: string };

export abstract class TerminalMonitorPort {
  abstract readonly activity$: Observable<TerminalActivityEvent>;
  abstract readonly terminated$: Observable<TerminalId>;
  abstract readonly cwdChanges$: Observable<TerminalCwdChangeEvent>;
  abstract isTerminalActive(terminalId: TerminalId): boolean;
  abstract getCwd(terminalId: TerminalId): string | undefined;
}
