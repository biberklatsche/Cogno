import {
  ComponentRef,
  createEnvironmentInjector,
  EnvironmentInjector,
  Injectable,
} from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { TerminalAutocompleteService } from "@cogno/core/session/autocomplete/terminal-autocomplete.service";
import { SessionCommandLog } from "@cogno/core/session/command-log/session-command-log";
import { TerminalComposerService } from "@cogno/core/session/composer/terminal-composer.service";
import { TerminalHistoryService } from "@cogno/core/session/history/terminal-history.service";
import { PendingSessionSnapshots } from "@cogno/core/session/host/pending-session-snapshots";
import { SessionBackend } from "@cogno/core/session/host/session-backend";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { TerminalCommandHistoryStore } from "@cogno/core/session/model/command-history.store";
import { CommandRecorder } from "@cogno/core/session/recorder/command-recorder";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { RunningShell } from "@cogno/core/workbench/hosts/running-shell";
import { Opener, OsPlatform, PtyTransport } from "@cogno/platform";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { TerminalId } from "@cogno/shared/domain";
import { ContextMenuOverlayService } from "@cogno/shared/ui";
import { SessionClipboardPrompt } from "../../terminal/+state/session-clipboard-prompt";
import { SessionKeybindings } from "../../terminal/+state/session-keybindings";
import { SessionMenus } from "../../terminal/+state/session-menus";
import { SessionNotifications } from "../../terminal/+state/session-notifications";
import { TerminalSessionRegistry } from "../../terminal/+state/terminal-session.registry";
import { TerminalComponent } from "../../terminal/terminal.component";
import { TerminalFileDropService } from "../../terminal/terminal-file-drop.service";
import { Pane } from "../+model/model";

/** How a new session gets its shell. */
export type SessionStart =
  /** A new shell of the profile; a saved scrollback is replayed first. */
  | { readonly kind: "spawn"; readonly profile: ShellProfile }
  /** A shell that already runs is shown. */
  | { readonly kind: "showRunning"; readonly shell: RunningShell }
  /**
   * A shell that already runs, but another Cogno - or another window of this
   * one - shows it: `by` names that Cogno's machine when it said.
   */
  | { readonly kind: "shownElsewhere"; readonly shell: RunningShell; readonly by?: string };

/** A pane's session, with everything that lives and dies with it. */
export type SessionEntry = {
  /** The pane the session was made for. */
  readonly pane: Pane;
  /** Where the pane's shell runs. */
  readonly backend: SessionBackend;
  /** Everything that lives and dies with the session (ARCHITECTURE.md 2.2, axis 2). */
  readonly injector: EnvironmentInjector;
  readonly session: SessionHost;
  readonly keybindings: SessionKeybindings;
  readonly notifications: SessionNotifications;
  readonly clipboardPrompt: SessionClipboardPrompt;
  /** The pane's view; exists only once the pane was on screen. */
  view?: ComponentRef<TerminalComponent>;
};

/**
 * The session host is a plain class; Angular only wires its sources. Where
 * its shell runs is the session's own, not something to inject.
 */
function createSessionHost(backend: SessionBackend) {
  return (
    os: OsPlatform,
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

/**
 * Builds a pane's session: its scope of services, its host, and what has to
 * listen from the first fact on - and takes it down again.
 */
@Injectable({ providedIn: "root" })
export class SessionScopeBuilder {
  constructor(
    private readonly env: EnvironmentInjector,
    private readonly bus: AppBus,
    private readonly sessionRegistry: TerminalSessionRegistry,
    private readonly pendingSnapshots: PendingSessionSnapshots,
  ) {}

  /** Builds the session of `pane` and starts it as `start` says. */
  open(
    terminalId: TerminalId,
    pane: Pane,
    backend: SessionBackend,
    start: SessionStart,
  ): SessionEntry {
    const profile = start.kind === "spawn" ? start.profile : start.shell.profile;
    const injector = this.createScope(backend);
    const session = injector.get(SessionHost);
    const keybindings = injector.get(SessionKeybindings);
    session.initialize(terminalId, profile);
    // The registry owns the session's lifecycle now: it must know the host
    // before it starts so its facts$ carries every fact from the first one.
    this.sessionRegistry.register(terminalId, profile, session);
    keybindings.start(terminalId, profile);
    // The composer, notifications, clipboard prompt and menus listen from the
    // start; the view comes later.
    injector.get(TerminalComposerService);
    const notifications = injector.get(SessionNotifications);
    const clipboardPrompt = injector.get(SessionClipboardPrompt);
    injector.get(SessionMenus);
    // A saved scrollback is stashed before start(), so the host defers the
    // shell's start: the replay happens on the first attach, into an open,
    // final-sized terminal. A shell that runs has its host play back what it
    // kept instead, which is newer.
    const snapshot = this.pendingSnapshots.take(terminalId);
    if (start.kind === "spawn") {
      if (snapshot) session.restore(snapshot);
    } else {
      session.showRunning(start.shell.sessionToken);
    }
    if (start.kind === "shownElsewhere") {
      session.startShownElsewhere(start.by);
    } else {
      session.start();
    }
    return { pane, backend, injector, session, keybindings, notifications, clipboardPrompt };
  }

  /**
   * Takes the session down. `removed`: the terminal goes for good, and the
   * app hears TerminalRemoved before the machine goes, as it always did. A
   * session that is only replaced by another for the same shell is not.
   */
  close(terminalId: TerminalId, entry: SessionEntry, removed: boolean): void {
    // Destroying a view leaves its element where it was mounted; a session
    // that is replaced in place would otherwise sit above its successor.
    entry.view?.location.nativeElement.remove();
    entry.view?.destroy();
    entry.keybindings.dispose();
    entry.notifications.dispose();
    entry.clipboardPrompt.dispose();
    this.sessionRegistry.unregister(terminalId);
    if (removed) this.bus.publish({ type: "TerminalRemoved", payload: terminalId });
    entry.session.close(removed);
    entry.injector.destroy();
  }

  private createScope(backend: SessionBackend): EnvironmentInjector {
    return createEnvironmentInjector(
      [
        TerminalCommandHistoryStore,
        SessionCommandLog,
        CommandRecorder,
        {
          provide: SessionHost,
          useFactory: createSessionHost(backend),
          deps: [
            OsPlatform,
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
        SessionClipboardPrompt,
        SessionMenus,
        TerminalAutocompleteService,
        TerminalComposerService,
        TerminalHistoryService,
        TerminalFileDropService,
      ],
      this.env,
    );
  }
}
