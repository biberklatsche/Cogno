import { Injectable } from "@angular/core";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { Hosts, RunningSession } from "@cogno/platform/hosts";
import { TerminalId } from "@cogno/shared/domain";

/** The key of this machine among the hosts. */
const THIS_MACHINE = "";
/** How long what a host said counts as what runs there now. */
const FRESH_FOR_MS = 2000;

/**
 * The shells that already run on a host and that no pane of this window
 * shows yet: what Cogno left running when it closed, or what another Cogno
 * started there. A pane whose terminal is among them shows that shell
 * instead of starting one, and takes it off the list.
 *
 * The list of a host is as old as the last `refresh`: read when the app
 * starts (this machine) or connects (another one), and again before a new
 * tab on a connected host decides what to do (`isFresh`).
 */
@Injectable({ providedIn: "root" })
export class RunningSessionsService {
  private readonly byHost = new Map<string, Map<TerminalId, RunningSession>>();
  private readonly askedAt = new Map<string, number>();

  constructor(private readonly hosts: Hosts) {}

  /**
   * Asks `host` (this machine when left out) which shells run there. A host
   * that does not answer has none to go on with: the failure is reported,
   * not thrown, so a start is never held up by it.
   */
  async refresh(host?: string): Promise<void> {
    try {
      const sessions = await this.hosts.sessions(host);
      this.byHost.set(
        host ?? THIS_MACHINE,
        new Map(sessions.map((session) => [session.terminalId, session])),
      );
    } catch (error) {
      this.byHost.delete(host ?? THIS_MACHINE);
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "RunningSessions",
        context: { operation: "refresh", host },
      });
    }
    // Asked, whatever the answer: asking again at once would say the same.
    this.askedAt.set(host ?? THIS_MACHINE, Date.now());
  }

  /** Whether `host` was asked so recently that its list still holds. */
  isFresh(host: string | undefined): boolean {
    const askedAt = this.askedAt.get(host ?? THIS_MACHINE);
    return askedAt !== undefined && Date.now() - askedAt < FRESH_FOR_MS;
  }

  /** The running shell of `terminalId` on `host`, which a pane now shows. */
  take(host: string | undefined, terminalId: TerminalId): RunningSession | undefined {
    const sessions = this.byHost.get(host ?? THIS_MACHINE);
    const running = sessions?.get(terminalId);
    sessions?.delete(terminalId);
    return running;
  }

  /** The shells that run on `host` and that no pane has taken. */
  unclaimed(host: string | undefined): RunningSession[] {
    return [...(this.byHost.get(host ?? THIS_MACHINE)?.values() ?? [])];
  }
}
