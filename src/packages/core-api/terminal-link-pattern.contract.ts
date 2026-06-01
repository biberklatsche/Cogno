import { Observable } from "rxjs";

export abstract class TerminalLinkPatternPort {
  abstract pattern$(terminalId: string): Observable<string | undefined>;
  abstract setPattern(terminalId: string, pattern: string): void;
  abstract clearPattern(terminalId: string): void;
}
