import { DestroyRef, Injectable } from "@angular/core";
import { TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import { PtyTransport, SessionPlacementContract } from "@cogno/platform";
import { TerminalId } from "@cogno/shared/domain";
import { debounceTime, merge, Subject } from "rxjs";
import { TerminalSessionRegistry } from "../terminal/+state/terminal-session.registry";

/** A placement changes in bursts (a workspace is restored, a prompt returns). */
const SETTLE_MS = 250;

/**
 * Tells this machine's host where each of its shells sits in this Cogno:
 * workspace, tab, title and directory. Another Cogno that looks at the
 * machine finds a shell by that.
 *
 * Only the shells of this machine are placed. A shell of another machine
 * that is shown here keeps the placement of the Cogno it belongs to.
 */
@Injectable({ providedIn: "root" })
export class SessionPlacementPublisher {
  private readonly titles = new Map<TerminalId, string | undefined>();
  private readonly published = new Map<TerminalId, string>();
  private readonly changed = new Subject<void>();

  constructor(
    private readonly sessions: TerminalSessionRegistry,
    private readonly placement: TerminalPlacementPort,
    private readonly pty: PtyTransport,
    destroyRef: DestroyRef,
  ) {
    const subscription = merge(this.changed, this.placement.changes$)
      .pipe(debounceTime(SETTLE_MS))
      .subscribe(() => this.publish());
    subscription.add(this.sessions.changes$.subscribe(() => this.forgetGoneSessions()));
    // A shell is placed once it runs.
    subscription.add(this.sessions.runtimes$.subscribe(() => this.changed.next()));
    subscription.add(
      this.sessions.facts$.subscribe(({ terminalId, fact }) => {
        if (fact.type === "titleChanged") this.titles.set(terminalId, fact.title);
        if (fact.type === "titleChanged" || fact.type === "cwdReported") this.changed.next();
      }),
    );
    destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  /** Lets go of what was said about sessions that are gone. */
  private forgetGoneSessions(): void {
    // A title is kept for every session, also one that is never placed.
    for (const known of [this.titles, this.published]) {
      for (const terminalId of known.keys()) {
        if (!this.sessions.has(terminalId)) known.delete(terminalId);
      }
    }
  }

  private publish(): void {
    for (const { terminalId, host: session } of this.sessions.entries) {
      // The host knows a shell only while it runs.
      if (session.runtime.status !== "running") continue;
      if (session.state.shellContext.host !== undefined) continue;
      const placed = this.placement.getPlacement(terminalId);
      const placement: SessionPlacementContract = {
        workspace: placed?.workspaceName,
        tab: placed?.tabTitle || undefined,
        title: this.titles.get(terminalId),
        directory: session.state.cwd || undefined,
      };
      const rendered = JSON.stringify(placement);
      if (this.published.get(terminalId) === rendered) continue;
      this.published.set(terminalId, rendered);
      this.pty.place(terminalId, placement).catch(() => {
        // The shell ended in the meantime, or the host is gone: said again
        // with the next change, if there is one.
        this.published.delete(terminalId);
      });
    }
  }
}
