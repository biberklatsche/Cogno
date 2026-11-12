import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  Injectable,
  Type,
} from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { TerminalAutocompleteService } from "@cogno/core/session/autocomplete/terminal-autocomplete.service";
import { SessionCommandLog } from "@cogno/core/session/command-log/session-command-log";
import { TerminalComposerService } from "@cogno/core/session/composer/terminal-composer.service";
import { TerminalHistoryService } from "@cogno/core/session/history/terminal-history.service";
import { PendingSessionSnapshots } from "@cogno/core/session/host/pending-session-snapshots";
import { SessionBackend } from "@cogno/core/session/host/session-backend";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { TerminalCommandHistoryStore } from "@cogno/core/session/model/command-history.store";
import { CommandRecorder } from "@cogno/core/session/recorder/command-recorder";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import {
  HostConnectionComponent,
  HostConnectionState,
} from "@cogno/core/workbench/remote/host-connection.component";
import { RemoteHostsService } from "@cogno/core/workbench/remote/remote-hosts.service";
import { RunningSessionsService } from "@cogno/core/workbench/remote/running-sessions.service";
import { Opener, OsPlatform, PtyTransport } from "@cogno/platform";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { RunningSession } from "@cogno/platform/hosts";
import { TerminalId } from "@cogno/shared/domain";
import { ContextMenuOverlayService } from "@cogno/shared/ui";
import { SessionKeybindings } from "../../terminal/+state/session-keybindings";
import { SessionMenus } from "../../terminal/+state/session-menus";
import { SessionNotifications } from "../../terminal/+state/session-notifications";
import { TerminalSessionRegistry } from "../../terminal/+state/terminal-session.registry";
import { TerminalComponent } from "../../terminal/terminal.component";
import { TerminalFileDropService } from "../../terminal/terminal-file-drop.service";
import { Pane } from "../+model/model";

/**
 * The profile a session of a shell that already runs works with: what kind
 * of shell it is comes from the shell itself, not from what the profile of
 * that name says today.
 */
function profileOfRunning(configured: ShellProfile, running: RunningSession): ShellProfile {
  return {
    ...configured,
    shell_type: running.profile.shell_type as ShellProfile["shell_type"],
    enable_shell_integration:
      running.profile.enable_shell_integration ?? configured.enable_shell_integration,
  };
}

/**
 * The host is a plain class; Angular only wires its sources. Where its shell
 * runs is the session's own, not something to inject.
 */
function createSessionHost(backend: SessionBackend) {
  return (
    os: OsPlatform,
    environment: Environment,
    clipboard: ClipboardAccess,
    configService: ConfigService,
    opener: Opener,
    contextMenuOverlay: ContextMenuOverlayService,
    ptyTransport: PtyTransport,
    historyStore: TerminalCommandHistoryStore,
    recorder: CommandRecorder,
  ): SessionHost =>
    new SessionHost(
      os,
      environment,
      clipboard,
      configService,
      opener,
      contextMenuOverlay,
      ptyTransport,
      historyStore,
      recorder,
      backend,
    );
}

type SessionEntry = {
  /** The pane the session was made for. */
  readonly pane: Pane;
  /** Everything that lives and dies with the session (ARCHITECTURE.md 2.2, axis 2). */
  readonly injector: EnvironmentInjector;
  readonly host: SessionHost;
  readonly keybindings: SessionKeybindings;
  readonly notifications: SessionNotifications;
  /** The pane's view; exists only once the pane was on screen. */
  componentRef?: ComponentRef<TerminalComponent>;
};

/**
 * A pane whose shell runs on a machine that is not connected (yet), or whose
 * shell is not there. It has no session: a session needs to know the
 * operating system its shell runs on, and only the connected machine says
 * that.
 */
type WaitingPane = {
  readonly pane: Pane;
  readonly host: string;
  state: HostConnectionState;
  /** Where the pane is on screen, once it was. */
  dock?: HTMLElement;
  view?: ComponentRef<HostConnectionComponent>;
};

/**
 * Owns the sessions: one host per terminal id, started as soon as the pane
 * exists in the layout - visible or not - and closed only on an explicit
 * destroy. The view is created lazily on the first attach and reparented
 * afterwards; destroying a view never ends a session (ARCHITECTURE.md 2.3).
 *
 * A pane whose shell already runs - Cogno was closed and the shell went on,
 * or another Cogno started it - gets a session that shows that shell instead
 * of starting one.
 *
 * A pane of another machine (`Pane.host`) only ever shows a shell that runs
 * there. While that machine is not connected it waits, and shows how far the
 * connection is; when its shell is gone it says so and starts none.
 */
@Injectable({ providedIn: "root" })
export class SessionHostFactory {
  private readonly sessions = new Map<TerminalId, SessionEntry>();
  private readonly waiting = new Map<TerminalId, WaitingPane>();

  constructor(
    private readonly env: EnvironmentInjector,
    private readonly appRef: ApplicationRef,
    private readonly configService: ConfigService,
    private readonly bus: AppBus,
    private readonly sessionRegistry: TerminalSessionRegistry,
    private readonly pendingSnapshots: PendingSessionSnapshots,
    private readonly os: OsPlatform,
    private readonly remoteHosts: RemoteHostsService,
    private readonly runningSessions: RunningSessionsService,
    destroyRef: DestroyRef,
  ) {
    const retakes = this.bus
      .on$("RetakeTerminal")
      .subscribe((action) => action.payload && void this.retake(action.payload));
    // A shell that another Cogno took and let go again comes back by itself,
    // into the pane that still says where it went.
    retakes.add(
      this.sessionRegistry.facts$.subscribe(({ terminalId, fact }) => {
        if (fact.type === "releasedElsewhere") void this.retake(terminalId);
      }),
    );
    destroyRef.onDestroy(() => retakes.unsubscribe());
  }

  /**
   * Makes sure the pane's session exists and runs; a no-op once it does.
   * Returns nothing for a pane that waits for its machine.
   */
  ensureSession(pane: Pane): SessionEntry | undefined {
    const terminalId = pane.terminalId;
    if (!terminalId) return undefined;
    const existing = this.sessions.get(terminalId);
    if (existing) return existing;

    const shellProfile = this.shellProfileFor(pane);
    const remote = pane.host === undefined ? undefined : this.remoteHosts.info(pane.host);
    if (pane.host !== undefined && !remote) {
      this.waitFor(pane, terminalId, pane.host, "connect");
      return undefined;
    }
    const backend: SessionBackend =
      pane.host !== undefined && remote
        ? { host: pane.host, os: remote.os }
        : { os: this.os.platform() };
    const running = this.runningSessions.take(pane.host, terminalId);
    if (!running && pane.host !== undefined) {
      if (!this.runningSessions.isFresh(pane.host)) {
        // What runs there was last heard when the host connected, which may
        // be hours ago.
        this.waitFor(pane, terminalId, pane.host, "look");
        return undefined;
      }
      this.waiting.set(terminalId, { pane, host: pane.host, state: { status: "gone" } });
      return undefined;
    }
    const sessionProfile = running ? profileOfRunning(shellProfile, running) : shellProfile;

    const injector = createEnvironmentInjector(
      [
        TerminalCommandHistoryStore,
        SessionCommandLog,
        CommandRecorder,
        {
          provide: SessionHost,
          useFactory: createSessionHost(backend),
          deps: [
            OsPlatform,
            Environment,
            ClipboardAccess,
            ConfigService,
            Opener,
            ContextMenuOverlayService,
            PtyTransport,
            TerminalCommandHistoryStore,
            CommandRecorder,
          ],
        },
        SessionKeybindings,
        SessionNotifications,
        SessionMenus,
        TerminalAutocompleteService,
        TerminalComposerService,
        TerminalHistoryService,
        TerminalFileDropService,
      ],
      this.env,
    );
    const host = injector.get(SessionHost);
    const keybindings = injector.get(SessionKeybindings);
    host.initialize(terminalId, sessionProfile);
    // The registry owns the session's lifecycle now: it must know the host
    // before it starts so its facts$ carries every fact from the first one.
    this.sessionRegistry.register(terminalId, sessionProfile, host);
    keybindings.start(terminalId, sessionProfile);
    // The composer, notifications and menus listen from the start; the view
    // comes later.
    injector.get(TerminalComposerService);
    const notifications = injector.get(SessionNotifications);
    injector.get(SessionMenus);
    // Session restore: stash the saved scrollback before start() so
    // the host defers the shell spawn; the replay happens on the first attach,
    // into an open, final-sized terminal.
    const snapshot = this.pendingSnapshots.take(terminalId);
    if (running) {
      // The shell runs: its host plays back what it kept, which is newer
      // than the snapshot, and the session takes the secret it was started
      // with.
      host.resume(running.profile.env?.["COGNO_SESSION_TOKEN"] ?? "");
    } else if (snapshot) {
      host.restore(snapshot);
    }
    host.start();

    const entry: SessionEntry = { pane, injector, host, keybindings, notifications };
    this.sessions.set(terminalId, entry);
    return entry;
  }

  /** Puts the pane's view into `hostElement`, creating it the first time. */
  /** The keybindings of the session `terminalId`, for central action dispatch. */
  getSessionKeybindings(terminalId: TerminalId): SessionKeybindings | undefined {
    return this.sessions.get(terminalId)?.keybindings;
  }

  /** The live host of the session `terminalId`, for snapshotting. */
  getSessionHost(terminalId: TerminalId): SessionHost | undefined {
    return this.sessions.get(terminalId)?.host;
  }

  /** Every live session host, for recording aborted commands on quit. */
  getAllSessionHosts(): SessionHost[] {
    return [...this.sessions.values()].map((session) => session.host);
  }

  attach(pane: Pane, hostElement: HTMLElement): void {
    const entry = this.ensureSession(pane);
    if (!entry) {
      this.showWaiting(pane.terminalId, hostElement);
      return;
    }
    if (!entry.componentRef) {
      const ref = createComponent(TerminalComponent as Type<TerminalComponent>, {
        environmentInjector: entry.injector,
      });
      this.appRef.attachView(ref.hostView);
      ref.changeDetectorRef.detectChanges();
      entry.componentRef = ref;
    }
    hostElement.appendChild(entry.componentRef.location.nativeElement); // reparent, no rebuild
    entry.componentRef.changeDetectorRef.detectChanges();
  }

  /** Final close (pane removed): the view, the session and everything bound to it. */
  destroy(terminalId?: TerminalId): void {
    if (!terminalId) return;
    const waiting = this.waiting.get(terminalId);
    if (waiting) {
      // A connection that still comes finds the pane gone and starts nothing.
      this.waiting.delete(terminalId);
      this.removeWaitingView(waiting);
    }
    this.endSession(terminalId, true);
  }

  /**
   * Ends the pane's session here. `removed`: the terminal goes for good, and
   * the app hears TerminalRemoved before the machine goes, as it always did.
   * A session that is only replaced by another for the same shell is not.
   */
  private endSession(terminalId: TerminalId, removed: boolean): void {
    const entry = this.sessions.get(terminalId);
    if (!entry) return;
    try {
      entry.componentRef?.destroy();
      entry.keybindings.dispose();
      entry.notifications.dispose();
      this.sessionRegistry.unregister(terminalId);
      if (removed) this.bus.publish({ type: "TerminalRemoved", payload: terminalId });
      entry.host.close();
      entry.injector.destroy();
    } finally {
      this.sessions.delete(terminalId);
    }
  }

  /**
   * The pane waits for its machine: until it is connected, or until it said
   * what runs there now. Then the pane decides again.
   */
  private waitFor(
    pane: Pane,
    terminalId: TerminalId,
    host: string,
    first: "connect" | "look",
  ): void {
    if (this.waiting.has(terminalId)) return;
    const waiting: WaitingPane = {
      pane,
      host,
      state: { status: first === "connect" ? "connecting" : "looking" },
    };
    this.waiting.set(terminalId, waiting);
    if (first === "connect") {
      this.connect(terminalId, waiting);
    } else {
      this.lookAgain(terminalId, waiting);
    }
  }

  private lookAgain(terminalId: TerminalId, waiting: WaitingPane): void {
    this.setWaitingState(waiting, { status: "looking" });
    void this.runningSessions.refresh(waiting.host).then((answered) => {
      if (this.waiting.get(terminalId) !== waiting) return;
      if (answered) {
        this.proceed(terminalId, waiting);
      } else {
        this.setWaitingState(waiting, {
          status: "unreachable",
          reason: "It did not say which shells run there.",
        });
      }
    });
  }

  /** The pane stops waiting and gets its session (or waits for the next thing). */
  private proceed(terminalId: TerminalId, waiting: WaitingPane): void {
    if (this.waiting.get(terminalId) !== waiting) return;
    this.waiting.delete(terminalId);
    this.removeWaitingView(waiting);
    if (waiting.dock) {
      this.attach(waiting.pane, waiting.dock);
    } else {
      this.ensureSession(waiting.pane);
    }
  }

  /**
   * Another Cogno took the pane's shell over; it is shown here again - the
   * user asked for it, or that Cogno let the shell go. The
   * session that lost it is of no use any more: a new one attaches to the
   * shell and gets its output from the host afresh.
   */
  private async retake(terminalId: TerminalId): Promise<void> {
    const entry = this.sessions.get(terminalId);
    if (!entry || entry.host.runtime.status !== "takenOver") return;
    const dock = entry.componentRef?.location.nativeElement.parentElement ?? undefined;
    // Without an answer the new session would take the shell for gone - or,
    // on this machine, start another one under its id.
    if (!(await this.runningSessions.refresh(entry.pane.host))) return;
    if (this.sessions.get(terminalId) !== entry) return;
    // The terminal stays: features must not hear that it went.
    this.endSession(terminalId, false);
    if (dock) {
      this.attach(entry.pane, dock);
    } else {
      this.ensureSession(entry.pane);
    }
  }

  private connect(terminalId: TerminalId, waiting: WaitingPane): void {
    this.setWaitingState(waiting, { status: "connecting" });
    this.remoteHosts.connect(waiting.host).then(
      // Closed in the meantime: `proceed` finds the pane gone and starts
      // nothing.
      () => this.proceed(terminalId, waiting),
      (error: Error) => {
        if (this.waiting.get(terminalId) !== waiting) return;
        this.setWaitingState(waiting, { status: "unreachable", reason: error.message });
      },
    );
  }

  /** Puts the connection's progress where the pane's terminal will be. */
  private showWaiting(terminalId: TerminalId | undefined, hostElement: HTMLElement): void {
    const waiting = terminalId && this.waiting.get(terminalId);
    if (!terminalId || !waiting) return;
    waiting.dock = hostElement;
    if (!waiting.view) {
      const view = createComponent(HostConnectionComponent, { environmentInjector: this.env });
      view.setInput("host", waiting.host);
      view.setInput("state", waiting.state);
      view.instance.retry.subscribe(() => this.connect(terminalId, waiting));
      view.instance.closePane.subscribe(() =>
        this.bus.publish(ActionFired.create("close_terminal", undefined, undefined, terminalId)),
      );
      this.appRef.attachView(view.hostView);
      waiting.view = view;
    }
    hostElement.appendChild(waiting.view.location.nativeElement);
    waiting.view.changeDetectorRef.detectChanges();
  }

  private setWaitingState(waiting: WaitingPane, state: HostConnectionState): void {
    waiting.state = state;
    waiting.view?.setInput("state", state);
    waiting.view?.changeDetectorRef.detectChanges();
  }

  private removeWaitingView(waiting: WaitingPane): void {
    waiting.view?.location.nativeElement.remove();
    waiting.view?.destroy();
    waiting.view = undefined;
  }

  private shellProfileFor(pane: Pane): ShellProfile {
    const shellProfile = this.configService.getShellProfileOrDefault(pane.shellName);
    if (pane.workingDir) {
      shellProfile.working_dir = pane.workingDir;
    }
    return shellProfile;
  }
}
