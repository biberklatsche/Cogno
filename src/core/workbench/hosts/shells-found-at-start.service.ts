import { Injectable } from "@angular/core";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { SessionInfoContract } from "@cogno/platform";
import { Hosts } from "@cogno/platform/hosts";
import { TerminalId } from "@cogno/shared/domain";

/**
 * The shells that ran on this machine when the window started: what Cogno
 * left running when it closed. Asked for once, before the first pane is
 * restored, so that a pane whose shell runs shows it right away instead of
 * replaying its saved scrollback and starting another.
 *
 * It is a hint, never the last word: a shell may end or start after the
 * list was made. A pane that finds its shell gone when it attaches starts
 * one; one that finds a shell when it starts attaches to it (the host says
 * both by their codes).
 */
@Injectable({ providedIn: "root" })
export class ShellsFoundAtStart {
  private readonly found = new Map<TerminalId, SessionInfoContract>();
  private readonly unshownAtStart: TerminalId[] = [];

  constructor(private readonly hosts: Hosts) {}

  /**
   * Asks this machine which shells run there. A host that does not answer
   * has none to go on with: the failure is reported, not thrown, so the start
   * is never held up by it. Asking also starts the host if none runs.
   */
  async find(): Promise<void> {
    try {
      for (const session of await this.hosts.sessions(undefined)) {
        this.found.set(session.terminalId, session);
        if (session.attached.to === "nowhere") this.unshownAtStart.push(session.terminalId);
      }
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "ShellsFoundAtStart",
        context: { operation: "find" },
      });
    }
  }

  /** The shells no Cogno showed when the window started. */
  unshown(): readonly TerminalId[] {
    return this.unshownAtStart;
  }

  /** The shell of `terminalId`, for the pane that shows it; once. */
  claim(terminalId: TerminalId): SessionInfoContract | undefined {
    const shell = this.found.get(terminalId);
    this.found.delete(terminalId);
    return shell;
  }
}
