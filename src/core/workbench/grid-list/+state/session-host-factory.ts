import { ApplicationRef, createComponent, DestroyRef, Injectable, Type } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { SessionBackend } from "@cogno/core/session/host/session-backend";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { runningShell } from "@cogno/core/workbench/hosts/running-shell";
import { ShellsFoundAtStart } from "@cogno/core/workbench/hosts/shells-found-at-start.service";
import { isHostError, OsPlatform, SessionInfoContract } from "@cogno/platform";
import { Hosts } from "@cogno/platform/hosts";
import { TerminalId } from "@cogno/shared/domain";
import { SessionKeybindings } from "../../terminal/+state/session-keybindings";
import { TerminalSessionRegistry } from "../../terminal/+state/terminal-session.registry";
import { TerminalComponent } from "../../terminal/terminal.component";
import { Pane } from "../+model/model";
import { SessionEntry, SessionScopeBuilder, SessionStart } from "./session-scope.builder";
import { WaitingPanes } from "./waiting-panes";

/** A pane whose shell runs on another machine. */
type RemotePane = Pane & { readonly host: string };

function isRemote(pane: Pane): pane is RemotePane {
  return pane.host !== undefined;
}

/**
 * Owns the sessions: one per terminal id, started as soon as the pane exists
 * in the layout - visible or not - and closed only on an explicit destroy.
 * The view is created lazily on the first mount and moved afterwards;
 * destroying a view never ends a session (ARCHITECTURE.md 2.3).
 *
 * A pane of this machine starts its shell - or, when the shell already runs
 * (Cogno was closed and it went on, or another Cogno started it), shows it.
 * A pane of another machine (`Pane.host`) only ever shows a shell that runs
 * there: it waits (`WaitingPanes`) until that machine is connected and has
 * said that the shell runs.
 */
@Injectable({ providedIn: "root" })
export class SessionHostFactory {
  private readonly sessions = new Map<TerminalId, SessionEntry>();
  /** Where each pane is on screen, once it was. */
  private readonly mountPoints = new Map<TerminalId, HTMLElement>();

  constructor(
    private readonly appRef: ApplicationRef,
    private readonly configService: ConfigService,
    private readonly bus: AppBus,
    private readonly sessionRegistry: TerminalSessionRegistry,
    private readonly os: OsPlatform,
    private readonly hosts: Hosts,
    private readonly shellsFoundAtStart: ShellsFoundAtStart,
    private readonly scopes: SessionScopeBuilder,
    private readonly waitingPanes: WaitingPanes,
    destroyRef: DestroyRef,
  ) {
    const reopenings = this.bus
      .on$("ReattachTerminal")
      .subscribe((action) => action.payload && void this.takeBack(action.payload));
    reopenings.add(
      this.sessionRegistry.facts$.subscribe(({ terminalId, fact }) => {
        // A shell that another Cogno took and let go again comes back by
        // itself, into the pane that still says where it went.
        if (fact.type === "handedBack") void this.takeBack(terminalId);
        // A shell already ran when the pane wanted to start one - Cogno did
        // not know it was there: it is shown instead.
        if (fact.type === "shellAlreadyRuns") void this.showRunningShell(terminalId);
        // The shell the pane was to show had ended by then.
        if (fact.type === "shellGone") this.onShellGone(terminalId);
      }),
    );
    destroyRef.onDestroy(() => reopenings.unsubscribe());
  }

  /**
   * Makes sure the pane's session exists and runs; a no-op once it does.
   * Returns nothing for a pane that has no session yet: one that waits for
   * its machine, or whose shell is gone.
   */
  ensureSession(pane: Pane): SessionEntry | undefined {
    const terminalId = pane.terminalId;
    if (!terminalId) return undefined;
    const existing = this.sessions.get(terminalId);
    if (existing) return existing;
    if (this.waitingPanes.isWaiting(terminalId)) return undefined;

    if (isRemote(pane)) {
      this.waitingPanes.wait(pane, ({ session, os }) =>
        this.open(terminalId, pane, { host: pane.host, os }, this.showing(pane, session)),
      );
      return undefined;
    }
    const backend: SessionBackend = { os: this.os.platform() };
    const running = this.shellsFoundAtStart.claim(terminalId);
    const start: SessionStart = running
      ? this.showing(pane, running)
      : { kind: "spawn", profile: this.configuredProfile(pane) };
    return this.open(terminalId, pane, backend, start);
  }

  /** The keybindings of the session `terminalId`, for central action dispatch. */
  getSessionKeybindings(terminalId: TerminalId): SessionKeybindings | undefined {
    return this.sessions.get(terminalId)?.keybindings;
  }

  /** The live host of the session `terminalId`, for snapshotting. */
  getSessionHost(terminalId: TerminalId): SessionHost | undefined {
    return this.sessions.get(terminalId)?.session;
  }

  /** Every live session host, for recording aborted commands on quit. */
  getAllSessionHosts(): SessionHost[] {
    return [...this.sessions.values()].map((entry) => entry.session);
  }

  /** Puts the pane's terminal - or what it shows while it waits - at `mountPoint`. */
  mount(pane: Pane, mountPoint: HTMLElement): void {
    const terminalId = pane.terminalId;
    if (!terminalId) return;
    this.mountPoints.set(terminalId, mountPoint);
    const entry = this.ensureSession(pane);
    if (entry) {
      this.mountView(entry, mountPoint);
    } else {
      this.waitingPanes.mount(terminalId, mountPoint);
    }
  }

  /** Final close (pane removed): the view, the session and everything bound to it. */
  destroy(terminalId?: TerminalId): void {
    if (!terminalId) return;
    // An answer that still comes finds the pane gone and opens nothing.
    this.waitingPanes.stop(terminalId);
    this.mountPoints.delete(terminalId);
    this.closeSession(terminalId, true);
  }

  /**
   * Shows the shell of a pane whose session lost it to another Cogno again
   * here: the user asked for it, or that Cogno let it go. Resolves to whether
   * the pane shows it now.
   */
  async takeBack(terminalId: TerminalId): Promise<boolean> {
    const entry = this.sessions.get(terminalId);
    if (entry?.session.runtime.status !== "takenOver") return false;
    return this.reopenShowingRunning(terminalId, entry);
  }

  /** A pane's start found its shell running already: it is shown instead. */
  private async showRunningShell(terminalId: TerminalId): Promise<void> {
    const entry = this.sessions.get(terminalId);
    if (entry?.session.runtime.status !== "starting") return;
    await this.reopenShowingRunning(terminalId, entry);
  }

  /**
   * The pane's session gives way to one that shows the running shell. The
   * shell is asked for first: the new session needs its profile and secret,
   * and the shell may have ended meanwhile.
   */
  private async reopenShowingRunning(
    terminalId: TerminalId,
    entry: SessionEntry,
  ): Promise<boolean> {
    let running: SessionInfoContract;
    try {
      running = await this.hosts.session(entry.pane.host, terminalId);
    } catch (error) {
      if (this.sessions.get(terminalId) !== entry) return false;
      if (isHostError(error, "sessionNotFound")) {
        this.onShellGone(terminalId);
      } else if (entry.session.runtime.status === "starting") {
        entry.session.failStart(error);
      } else {
        ErrorReporter.reportException({
          error,
          handled: true,
          source: "SessionHostFactory",
          context: { operation: "reopenShowingRunning", terminalId },
        });
      }
      return false;
    }
    if (this.sessions.get(terminalId) !== entry) return false;
    this.reopen(terminalId, entry, this.showing(entry.pane, running));
    return true;
  }

  /**
   * The shell a session was to show had ended: a pane of this machine starts
   * a new one, a pane of another says that it is gone.
   */
  private onShellGone(terminalId: TerminalId): void {
    const entry = this.sessions.get(terminalId);
    if (!entry) return;
    const pane = entry.pane;
    if (isRemote(pane)) {
      // The terminal stays: features must not hear that it went.
      this.closeSession(terminalId, false);
      this.waitingPanes.showGone(pane);
      const mountPoint = this.mountPoints.get(terminalId);
      if (mountPoint) this.waitingPanes.mount(terminalId, mountPoint);
      return;
    }
    this.reopen(terminalId, entry, { kind: "spawn", profile: this.configuredProfile(pane) });
  }

  /**
   * Replaces the pane's session by a new one that starts as `start` says, on
   * screen where the pane is. The terminal stays: features must not hear
   * that it went.
   */
  private reopen(terminalId: TerminalId, entry: SessionEntry, start: SessionStart): void {
    this.closeSession(terminalId, false);
    this.open(terminalId, entry.pane, entry.backend, start);
  }

  private open(
    terminalId: TerminalId,
    pane: Pane,
    backend: SessionBackend,
    start: SessionStart,
  ): SessionEntry {
    const entry = this.scopes.open(terminalId, pane, backend, start);
    this.sessions.set(terminalId, entry);
    const mountPoint = this.mountPoints.get(terminalId);
    if (mountPoint) this.mountView(entry, mountPoint);
    return entry;
  }

  private closeSession(terminalId: TerminalId, removed: boolean): void {
    const entry = this.sessions.get(terminalId);
    if (!entry) return;
    try {
      this.scopes.close(terminalId, entry, removed);
    } finally {
      this.sessions.delete(terminalId);
    }
  }

  private mountView(entry: SessionEntry, mountPoint: HTMLElement): void {
    if (!entry.view) {
      const view = createComponent(TerminalComponent as Type<TerminalComponent>, {
        environmentInjector: entry.injector,
      });
      this.appRef.attachView(view.hostView);
      view.changeDetectorRef.detectChanges();
      entry.view = view;
    }
    mountPoint.appendChild(entry.view.location.nativeElement); // moved, not rebuilt
    entry.view.changeDetectorRef.detectChanges();
  }

  /** How the pane's session shows `running`, a shell that already runs. */
  private showing(pane: Pane, running: SessionInfoContract): SessionStart {
    return { kind: "showRunning", shell: runningShell(this.configuredProfile(pane), running) };
  }

  private configuredProfile(pane: Pane): ShellProfile {
    const shellProfile = this.configService.getShellProfileOrDefault(pane.shellName);
    if (pane.workingDir) {
      shellProfile.working_dir = pane.workingDir;
    }
    return shellProfile;
  }
}
