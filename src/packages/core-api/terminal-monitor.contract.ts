import { Observable } from "rxjs";

export type TerminalActivityEvent = { terminalId: string; isBusy: boolean };

export abstract class TerminalMonitorPort {
  abstract readonly activity$: Observable<TerminalActivityEvent>;
  abstract readonly terminated$: Observable<string>;
}
