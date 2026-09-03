import { Injectable } from "@angular/core";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { SessionFact } from "@cogno/core/session/session-facts";
import { TerminalId } from "@cogno/shared/ports";
import { Observable, Subject, Subscription } from "rxjs";

type TerminalSessionRegistryEntry = {
  readonly terminalId: TerminalId;
  readonly shellProfile: ShellProfile;
  readonly host: SessionHost;
};

/** A session fact tagged with the terminal it came from. */
export interface IdentifiedSessionFact {
  readonly terminalId: TerminalId;
  readonly fact: SessionFact;
}

/**
 * The running sessions by terminal id, for the adapters that answer for them.
 *
 * It also re-attaches the terminal id to each host's facts and merges them into
 * one `facts$` stream, so the app-wide workbench services can subscribe to every
 * session's facts directly - the facts themselves carry no id (they are per
 * host), so the registry, which owns the id-to-host mapping, is where the id is
 * put back on.
 */
@Injectable({ providedIn: "root" })
export class TerminalSessionRegistry {
  private readonly entriesByTerminalId = new Map<TerminalId, TerminalSessionRegistryEntry>();
  private readonly factSubscriptions = new Map<TerminalId, Subscription>();
  private readonly facts = new Subject<IdentifiedSessionFact>();

  /** Every session's facts, each tagged with its terminal id. */
  readonly facts$: Observable<IdentifiedSessionFact> = this.facts.asObservable();

  register(terminalId: TerminalId, shellProfile: ShellProfile, host: SessionHost): void {
    this.entriesByTerminalId.set(terminalId, { terminalId, shellProfile, host });
    this.factSubscriptions.get(terminalId)?.unsubscribe();
    this.factSubscriptions.set(
      terminalId,
      host.facts$.subscribe((fact) => this.facts.next({ terminalId, fact })),
    );
  }

  unregister(terminalId: TerminalId | undefined): void {
    if (!terminalId) {
      return;
    }
    this.factSubscriptions.get(terminalId)?.unsubscribe();
    this.factSubscriptions.delete(terminalId);
    this.entriesByTerminalId.delete(terminalId);
  }

  get(terminalId: TerminalId | undefined): TerminalSessionRegistryEntry | undefined {
    if (!terminalId) {
      return undefined;
    }
    return this.entriesByTerminalId.get(terminalId);
  }

  has(terminalId: TerminalId | undefined): boolean {
    return this.get(terminalId) !== undefined;
  }
}
