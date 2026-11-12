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
import { IdCreator } from "@cogno/core/workbench/id-creator";
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
 * A pane whose shell runs on a machine that is not connected (yet), or that
 * asks what to do with the shells already running there. It has no session:
 * a session needs to know the operating system its shell runs on, and only
 * the connected machine says that.
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
 * A pane of a machine that is not connected waits: its session starts once
 * the connection stands, and until then the pane shows how far that is.
 *
 * A pane whose shell already runs - Cogno was closed and the shell went on,
 * or another Cogno started it - gets a session that shows that shell instead
 * of starting one.
 */
@Injectable({ providedIn: "root" })
export class SessionHostFactory {
  private readonly sessions = new Map<TerminalId, SessionEntry>();
  private readonly waiting = new Map<TerminalId, WaitingPane>();
  /** The hosts whose running shells the user was asked about and answered. */
  private readonly answeredHosts = new Set<string>();

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
    const backend = this.backendOf(shellProfile);
    if (!backend) {
      this.waitForHost(pane, terminalId, shellProfile.host as string);
      return undefined;
    }
    const running = this.runningSessions.take(shellProfile.host, terminalId);
    if (!running && shellProfile.host) {
      if (!this.runningSessions.isFresh(shellProfile.host)) {
        // What runs there was last heard when the host connected, which may
        // be hours ago.
        this.askAgain(pane, terminalId, shellProfile.host);
        return undefined;
      }
      if (this.hasSessionsToOffer(shellProfile.host)) {
        // Shells run there that nothing here shows: starting one more may
        // not be what the user came for.
        this.offerSessions(pane, terminalId, shellProfile.host);
        return undefined;
      }
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
    const entry = this.sessions.get(terminalId);
    if (!entry) return;
    try {
      entry.componentRef?.destroy();
      entry.keybindings.dispose();
      entry.notifications.dispose();
      // The app hears TerminalRemoved before the machine goes, as it always did.
      this.sessionRegistry.unregister(terminalId);
      this.bus.publish({ type: "TerminalRemoved", payload: terminalId });
      entry.host.close();
      entry.injector.destroy();
    } finally {
      this.sessions.delete(terminalId);
    }
  }

  /** Where the profile's shell runs; nothing while its machine is not connected. */
  private backendOf(shellProfile: ShellProfile): SessionBackend | undefined {
    if (!shellProfile.host) return { os: this.os.platform() };
    const info = this.remoteHosts.info(shellProfile.host);
    return info && { host: shellProfile.host, os: info.os };
  }

  private waitForHost(pane: Pane, terminalId: TerminalId, host: string): void {
    if (this.waiting.has(terminalId)) return;
    const waiting: WaitingPane = { pane, host, state: { status: "connecting" } };
    this.waiting.set(terminalId, waiting);
    this.connect(terminalId, waiting);
  }

  /** Asks the host what runs there now, then lets the pane decide again. */
  private askAgain(pane: Pane, terminalId: TerminalId, host: string): void {
    if (this.waiting.has(terminalId)) return;
    const waiting: WaitingPane = { pane, host, state: { status: "connecting" } };
    this.waiting.set(terminalId, waiting);
    // Never rejects: a host that does not answer has nothing to go on with.
    void this.runningSessions.refresh(host).then(() => this.proceed(terminalId, waiting));
  }

  /**
   * The shells that run on the host and that this window does not show. A
   * host can be this very machine, reached the long way round: its shells
   * that a pane here shows already are nothing to go on with.
   */
  private sessionsToOffer(host: string): RunningSession[] {
    return this.runningSessions
      .unclaimed(host)
      .filter((session) => !this.sessions.has(session.terminalId));
  }

  private hasSessionsToOffer(host: string): boolean {
    return !this.answeredHosts.has(host) && this.sessionsToOffer(host).length > 0;
  }

  /** The pane asks instead of starting a shell; see `HostConnectionComponent`. */
  private offerSessions(pane: Pane, terminalId: TerminalId, host: string): void {
    if (this.waiting.has(terminalId)) return;
    const count = this.sessionsToOffer(host).length;
    this.waiting.set(terminalId, { pane, host, state: { status: "sessions", count } });
  }

  /**
   * Every shell that runs on the host gets a tab of its own, which shows it;
   * the pane that asked has done its part and goes.
   */
  private goOnWithSessions(terminalId: TerminalId, waiting: WaitingPane): void {
    const sessions = this.sessionsToOffer(waiting.host);
    // Answered, whatever becomes of the tabs: a tab that cannot show its
    // shell after all must not ask the same question again.
    this.answeredHosts.add(waiting.host);
    sessions.forEach((session, index) => {
      this.bus.publish({
        type: "CreateTab",
        payload: {
          tabId: IdCreator.newTabId(),
          shellName: waiting.pane.shellName,
          terminalId: session.terminalId,
          isActive: index === 0,
        },
      });
    });
    this.bus.publish(ActionFired.create("close_terminal", undefined, undefined, terminalId));
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
   * Another Cogno took the pane's shell over; it is shown here again. The
   * session that lost it is of no use any more: a new one attaches to the
   * shell and gets its output from the host afresh.
   */
  private async retake(terminalId: TerminalId): Promise<void> {
    const entry = this.sessions.get(terminalId);
    if (!entry || entry.host.runtime.status !== "takenOver") return;
    const dock = entry.componentRef?.location.nativeElement.parentElement ?? undefined;
    await this.runningSessions.refresh(this.shellProfileFor(entry.pane).host);
    if (this.sessions.get(terminalId) !== entry) return;
    this.destroy(terminalId);
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
        this.setWaitingState(waiting, { status: "failed", reason: error.message });
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
      view.instance.takeOver.subscribe(() => this.goOnWithSessions(terminalId, waiting));
      view.instance.startNew.subscribe(() => {
        this.answeredHosts.add(waiting.host);
        this.proceed(terminalId, waiting);
      });
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
