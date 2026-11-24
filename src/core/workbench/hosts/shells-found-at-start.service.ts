import { Injectable } from "@angular/core";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { SessionInfoContract } from "@cogno/platform";
import { Hosts } from "@cogno/platform/hosts";
import { TerminalId } from "@cogno/shared/domain";

/**
 * The shells that ran on this machine when the webview started: none after
 * the app started, the window's after its webview was loaded again. Asked
 * for once, before the first pane is restored, so that a pane whose shell
 * runs shows it right away instead of replaying its saved scrollback and
 * starting another.
 *
 * It is a hint, never the last word: a shell may end or start after the
 * list was made. A pane that finds its shell gone when it attaches starts
 * one; one that finds a shell when it starts attaches to it (the host says
 * both by their codes).
 */
@Injectable({ providedIn: "root" })
export class ShellsFoundAtStart {
  private readonly found = new Map<TerminalId, SessionInfoContract>();

  constructor(private readonly hosts: Hosts) {}

  /**
   * Asks this machine which shells run there. A host that does not answer
   * has none to go on with: the failure is reported, not thrown, so the start
   * is never held up by it.
   */
  async find(): Promise<void> {
    try {
      for (const session of await this.hosts.sessions(undefined)) {
        this.found.set(session.terminalId, session);
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

  /** The shell of `terminalId`, for the pane that shows it; once. */
  claim(terminalId: TerminalId): SessionInfoContract | undefined {
    const shell = this.found.get(terminalId);
    this.found.delete(terminalId);
    return shell;
  }
}
