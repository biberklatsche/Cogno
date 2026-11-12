import { Injectable } from "@angular/core";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { Hosts, RunningSession } from "@cogno/platform/hosts";
import { TerminalId } from "@cogno/shared/domain";

/** The key of this machine among the hosts. */
const THIS_MACHINE = "";
/** How long what a host said counts as what runs there now. */
const FRESH_FOR_MS = 2000;

/** What a host said last, and when. */
type Answer = {
  readonly at: number;
  /** Empty when the host did not answer: then nothing is known to go on with. */
  readonly sessions: Map<TerminalId, RunningSession>;
};

/**
 * The shells that already run on a host and that no pane of this window
 * shows yet: what Cogno left running when it closed, or what another Cogno
 * started there. A pane whose terminal is among them shows that shell
 * instead of starting one, and takes it off the list.
 *
 * The list of a host is as old as the last `refresh`: read when the app
 * starts (this machine) or connects (another one), and again before a pane
 * of a connected host looks for its shell (`isFresh`).
 */
@Injectable({ providedIn: "root" })
export class RunningSessionsService {
  private readonly answers = new Map<string, Answer>();
  /** A question still on its way: whoever asks meanwhile shares it. */
  private readonly asking = new Map<string, Promise<boolean>>();

  constructor(private readonly hosts: Hosts) {}

  /**
   * Asks `host` (this machine when left out) which shells run there, and
   * says whether it answered. A host that does not answer has none to go on
   * with: the failure is reported, not thrown, so a start is never held up
   * by it.
   */
  refresh(host?: string): Promise<boolean> {
    const key = host ?? THIS_MACHINE;
    const underway = this.asking.get(key);
    if (underway) return underway;
    const asking = this.ask(host).finally(() => this.asking.delete(key));
    this.asking.set(key, asking);
    return asking;
  }

  /** Whether `host` was asked so recently that its list still holds. */
  isFresh(host: string): boolean {
    const answer = this.answers.get(host);
    return answer !== undefined && Date.now() - answer.at < FRESH_FOR_MS;
  }

  /**
   * The shells of this machine that no Cogno shows, as last heard: what the
   * start of the app gives a tab when no workspace has a pane for it.
   */
  unshownLocalShells(): RunningSession[] {
    return [...(this.answers.get(THIS_MACHINE)?.sessions.values() ?? [])].filter(
      (session) => !session.shown,
    );
  }

  /** The running shell of `terminalId` on `host`, which a pane now shows. */
  take(host: string | undefined, terminalId: TerminalId): RunningSession | undefined {
    const sessions = this.answers.get(host ?? THIS_MACHINE)?.sessions;
    const running = sessions?.get(terminalId);
    sessions?.delete(terminalId);
    return running;
  }

  private async ask(host: string | undefined): Promise<boolean> {
    try {
      const sessions = await this.hosts.sessions(host);
      this.remember(host, new Map(sessions.map((session) => [session.terminalId, session])));
      return true;
    } catch (error) {
      // Asked, whatever the answer: asking again at once would say the same.
      this.remember(host, new Map());
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "RunningSessions",
        context: { operation: "refresh", host },
      });
      return false;
    }
  }

  private remember(host: string | undefined, sessions: Map<TerminalId, RunningSession>): void {
    this.answers.set(host ?? THIS_MACHINE, { at: Date.now(), sessions });
  }
}
