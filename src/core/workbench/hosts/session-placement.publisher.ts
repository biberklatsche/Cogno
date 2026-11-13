import { DestroyRef, Injectable } from "@angular/core";
import { TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import { PtyTransport } from "@cogno/platform";
import { PtyLabelContract } from "@cogno/platform/pty";
import { TerminalId } from "@cogno/shared/domain";
import { debounceTime, merge, Subject, Subscription } from "rxjs";
import { TerminalSessionRegistry } from "../terminal/+state/terminal-session.registry";

/** A label changes in bursts (a workspace is restored, a prompt returns). */
const SETTLE_MS = 250;

/**
 * Tells this machine's host where each of its shells sits in this Cogno:
 * workspace, tab, title and directory. Another Cogno that looks at the
 * machine finds a shell by that, and so does this one for a shell no window
 * shows any more.
 *
 * Only the shells of this machine are labelled. A shell of another machine
 * that is shown here keeps the label of the Cogno it belongs to.
 */
@Injectable({ providedIn: "root" })
export class SessionLabelPublisher {
  private readonly watched = new Map<TerminalId, Subscription>();
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
    subscription.add(this.sessions.changes$.subscribe(() => this.watchSessions()));
    subscription.add(
      this.sessions.facts$.subscribe(({ terminalId, fact }) => {
        if (fact.type === "titleChanged") this.titles.set(terminalId, fact.title);
        if (fact.type === "titleChanged" || fact.type === "cwdReported") this.changed.next();
      }),
    );
    destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      for (const watching of this.watched.values()) watching.unsubscribe();
    });
    this.watchSessions();
  }

  /** Follows every session there is, and lets go of those that are gone. */
  private watchSessions(): void {
    for (const [terminalId, watching] of this.watched) {
      if (this.sessions.has(terminalId)) continue;
      watching.unsubscribe();
      this.watched.delete(terminalId);
      this.titles.delete(terminalId);
      this.published.delete(terminalId);
    }
    for (const { terminalId, host } of this.sessions.entries) {
      if (this.watched.has(terminalId)) continue;
      // A shell is labelled once it runs; the runtime is no fact.
      this.watched.set(
        terminalId,
        host.runtime$.subscribe(() => this.changed.next()),
      );
    }
  }

  private publish(): void {
    for (const { terminalId, host } of this.sessions.entries) {
      // The host knows a shell only while it runs.
      if (host.runtime.status !== "running") continue;
      if (host.state.shellContext.host !== undefined) continue;
      const placed = this.placement.getPlacement(terminalId);
      const label: PtyLabelContract = {
        workspace: placed?.workspaceName,
        tab: placed?.tabTitle || undefined,
        title: this.titles.get(terminalId),
        directory: host.state.cwd || undefined,
      };
      const rendered = JSON.stringify(label);
      if (this.published.get(terminalId) === rendered) continue;
      this.published.set(terminalId, rendered);
      this.pty.label(terminalId, label).catch(() => {
        // The shell ended in the meantime, or the host is gone: said again
        // with the next change, if there is one.
        this.published.delete(terminalId);
      });
    }
  }
}
