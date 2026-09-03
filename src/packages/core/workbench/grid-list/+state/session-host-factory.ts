import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  createEnvironmentInjector,
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
import { SessionHost } from "@cogno/core/session/host/session-host";
import { TerminalCommandHistoryStore } from "@cogno/core/session/model/command-history.store";
import { CommandRecorder } from "@cogno/core/session/recorder/command-recorder";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { Opener, OsPlatform, PtyTransport } from "@cogno/platform";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { TerminalId } from "@cogno/shared/ports";
import { ContextMenuOverlayService } from "@cogno/shared/ui";
import { SessionFactBridge } from "../../terminal/+state/session-fact-bridge";
import { SessionMenus } from "../../terminal/+state/session-menus";
import { SessionNotifications } from "../../terminal/+state/session-notifications";
import { TerminalSessionRegistry } from "../../terminal/+state/terminal-session.registry";
import { TerminalComponent } from "../../terminal/terminal.component";
import { TerminalFileDropService } from "../../terminal/terminal-file-drop.service";
import { Pane } from "../+model/model";

/** The host is a plain class; Angular only wires its sources. */
export function createSessionHost(
  os: OsPlatform,
  environment: Environment,
  clipboard: ClipboardAccess,
  configService: ConfigService,
  opener: Opener,
  contextMenuOverlay: ContextMenuOverlayService,
  ptyTransport: PtyTransport,
  historyStore: TerminalCommandHistoryStore,
  recorder: CommandRecorder,
): SessionHost {
  return new SessionHost(
    os,
    environment,
    clipboard,
    configService,
    opener,
    contextMenuOverlay,
    ptyTransport,
    historyStore,
    recorder,
  );
}

type SessionEntry = {
  /** Everything that lives and dies with the session (ARCHITECTURE.md 2.2, axis 2). */
  readonly injector: EnvironmentInjector;
  readonly host: SessionHost;
  readonly bridge: SessionFactBridge;
  readonly notifications: SessionNotifications;
  /** The pane's view; exists only once the pane was on screen. */
  componentRef?: ComponentRef<TerminalComponent>;
};

/**
 * Owns the sessions: one host per terminal id, started as soon as the pane
 * exists in the layout - visible or not - and closed only on an explicit
 * destroy. The view is created lazily on the first attach and reparented
 * afterwards; destroying a view never ends a session (ARCHITECTURE.md 2.3).
 */
@Injectable({ providedIn: "root" })
export class SessionHostFactory {
  private readonly sessions = new Map<TerminalId, SessionEntry>();

  constructor(
    private readonly env: EnvironmentInjector,
    private readonly appRef: ApplicationRef,
    private readonly configService: ConfigService,
    private readonly bus: AppBus,
    private readonly sessionRegistry: TerminalSessionRegistry,
  ) {}

  /** Makes sure the pane's session exists and runs; a no-op once it does. */
  ensureSession(pane: Pane): SessionEntry | undefined {
    const terminalId = pane.terminalId;
    if (!terminalId) return undefined;
    const existing = this.sessions.get(terminalId);
    if (existing) return existing;

    const injector = createEnvironmentInjector(
      [
        TerminalCommandHistoryStore,
        SessionCommandLog,
        CommandRecorder,
        {
          provide: SessionHost,
          useFactory: createSessionHost,
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
        SessionFactBridge,
        SessionNotifications,
        SessionMenus,
        TerminalAutocompleteService,
        TerminalComposerService,
        TerminalHistoryService,
        TerminalFileDropService,
      ],
      this.env,
    );
    const shellProfile = this.shellProfileFor(pane);
    const host = injector.get(SessionHost);
    const bridge = injector.get(SessionFactBridge);
    host.initialize(terminalId, shellProfile);
    // The registry owns the session's lifecycle now: it must know the host
    // before it starts so its facts$ carries every fact from the first one.
    this.sessionRegistry.register(terminalId, shellProfile, host);
    bridge.start(terminalId, shellProfile);
    // The composer, notifications and menus listen from the start; the view
    // comes later.
    injector.get(TerminalComposerService);
    const notifications = injector.get(SessionNotifications);
    injector.get(SessionMenus);
    host.start();

    const entry: SessionEntry = { injector, host, bridge, notifications };
    this.sessions.set(terminalId, entry);
    return entry;
  }

  /** Puts the pane's view into `hostElement`, creating it the first time. */
  attach(pane: Pane, hostElement: HTMLElement): void {
    const entry = this.ensureSession(pane);
    if (!entry) return;
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
    const entry = this.sessions.get(terminalId);
    if (!entry) return;
    try {
      entry.componentRef?.destroy();
      entry.bridge.dispose();
      entry.notifications.dispose();
      // The app hears TerminalRemoved before the machine goes, as it always did.
      this.sessionRegistry.unregister(terminalId);
      this.bus.publish({ type: "TerminalRemoved", path: ["app", "terminal"], payload: terminalId });
      entry.host.close();
      entry.injector.destroy();
    } finally {
      this.sessions.delete(terminalId);
    }
  }

  private shellProfileFor(pane: Pane): ShellProfile {
    const shellProfile = this.configService.getShellProfileOrDefault(pane.shellName);
    if (pane.workingDir) {
      shellProfile.working_dir = pane.workingDir;
    }
    return shellProfile;
  }
}
