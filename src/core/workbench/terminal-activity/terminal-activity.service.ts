import { Injectable } from "@angular/core";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TerminalId } from "@cogno/shared/domain";
import { filter, map, Observable, throttleTime } from "rxjs";

const ACTIVITY_THROTTLE_MS = 100;

@Injectable({ providedIn: "root" })
export class TerminalActivityService {
  constructor(private readonly sessionRegistry: TerminalSessionRegistry) {}

  /** Fires, throttled, whenever the terminal received output. */
  activity$(terminalId: TerminalId): Observable<void> {
    return this.sessionRegistry.facts$.pipe(
      filter((fact) => fact.terminalId === terminalId && fact.fact.type === "outputReceived"),
      map(() => undefined),
      throttleTime(ACTIVITY_THROTTLE_MS),
    );
  }
}
