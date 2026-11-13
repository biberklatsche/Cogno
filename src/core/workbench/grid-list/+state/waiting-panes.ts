import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  DestroyRef,
  EnvironmentInjector,
  Injectable,
} from "@angular/core";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { ConnectError, RemoteHostsService } from "@cogno/core/workbench/hosts/remote-hosts.service";
import {
  WaitingPaneComponent,
  WaitingPaneState,
} from "@cogno/core/workbench/hosts/waiting-pane.component";
import { isHostError, SessionInfoContract, toHostError } from "@cogno/platform";
import { Hosts } from "@cogno/platform/hosts";
import { OsType } from "@cogno/platform/os";
import { TerminalId } from "@cogno/shared/domain";
import { Pane } from "../+model/model";

/** The shell a waiting pane found, and the system it runs on. */
export type FoundShell = {
  readonly session: SessionInfoContract;
  readonly os: OsType;
};

type WaitingPane = {
  readonly terminalId: TerminalId;
  readonly host: string;
  /** Told once, when the shell is found; the pane stops waiting then. */
  readonly onFound: (found: FoundShell) => void;
  state: WaitingPaneState;
  /** Counts the attempts: the answer to an older one is no news. */
  attempt: number;
  view?: ComponentRef<WaitingPaneComponent>;
};

/**
 * The panes of other machines that have no session yet. A session needs the
 * profile of its shell and the system it runs on, and only the connected
 * machine says those: a pane waits until its machine is connected and has
 * said that its shell runs. Meanwhile it shows how far that is; when the
 * shell is gone, it says so.
 */
@Injectable({ providedIn: "root" })
export class WaitingPanes {
  private readonly waiting = new Map<TerminalId, WaitingPane>();

  constructor(
    private readonly env: EnvironmentInjector,
    private readonly appRef: ApplicationRef,
    private readonly bus: AppBus,
    private readonly remoteHosts: RemoteHostsService,
    private readonly hosts: Hosts,
    destroyRef: DestroyRef,
  ) {
    // A machine connected meanwhile - from the Remote panel, or for another
    // pane - is asked for the shells of the panes that gave up on it.
    const connections = this.remoteHosts.connections$.subscribe((states) => {
      for (const waiting of this.waiting.values()) {
        if (
          waiting.state.status === "connectFailed" &&
          states.get(waiting.host)?.status === "connected"
        ) {
          this.lookForShell(waiting);
        }
      }
    });
    destroyRef.onDestroy(() => connections.unsubscribe());
  }

  isWaiting(terminalId: TerminalId): boolean {
    return this.waiting.has(terminalId);
  }

  /**
   * The pane of `pane.host` waits for its shell: the machine is connected
   * if it is not, and asked for the shell. A no-op while it waits already.
   */
  wait(pane: Pane & { host: string }, onFound: (found: FoundShell) => void): void {
    const terminalId = pane.terminalId;
    if (!terminalId || this.waiting.has(terminalId)) return;
    const waiting: WaitingPane = {
      terminalId,
      host: pane.host,
      onFound,
      state: { status: "connecting" },
      attempt: 0,
    };
    this.waiting.set(terminalId, waiting);
    this.findShell(waiting);
  }

  /** The pane's shell is gone; the pane says so until it is closed. */
  showGone(pane: Pane & { host: string }): void {
    const terminalId = pane.terminalId;
    if (!terminalId) return;
    const waiting = this.waiting.get(terminalId);
    if (waiting) {
      waiting.attempt += 1;
      this.setState(waiting, { status: "shellGone" });
      return;
    }
    this.waiting.set(terminalId, {
      terminalId,
      host: pane.host,
      onFound: () => {},
      state: { status: "shellGone" },
      attempt: 0,
    });
  }

  /** Puts what the pane shows where the pane is on screen. */
  mount(terminalId: TerminalId, mountPoint: HTMLElement): void {
    const waiting = this.waiting.get(terminalId);
    if (!waiting) return;
    if (!waiting.view) {
      const view = createComponent(WaitingPaneComponent, { environmentInjector: this.env });
      view.setInput("host", waiting.host);
      view.setInput("state", waiting.state);
      view.instance.retry.subscribe(() => this.findShell(waiting));
      view.instance.closePane.subscribe(() =>
        this.bus.publish(ActionFired.create("close_terminal", undefined, undefined, terminalId)),
      );
      this.appRef.attachView(view.hostView);
      waiting.view = view;
    }
    mountPoint.appendChild(waiting.view.location.nativeElement);
    waiting.view.changeDetectorRef.detectChanges();
  }

  /** The pane waits no more: it got its session, or it was closed. */
  stop(terminalId: TerminalId): void {
    const waiting = this.waiting.get(terminalId);
    if (!waiting) return;
    this.waiting.delete(terminalId);
    waiting.view?.location.nativeElement.remove();
    waiting.view?.destroy();
  }

  private findShell(waiting: WaitingPane): void {
    if (this.remoteHosts.info(waiting.host)) {
      this.lookForShell(waiting);
    } else {
      this.connect(waiting);
    }
  }

  private connect(waiting: WaitingPane): void {
    const attempt = this.begin(waiting, { status: "connecting" });
    this.remoteHosts.connect(waiting.host).then(
      () => this.isCurrent(waiting, attempt) && this.lookForShell(waiting),
      (error: unknown) => {
        if (!this.isCurrent(waiting, attempt)) return;
        const failure = error instanceof ConnectError ? error.failure : toHostError(error);
        this.setState(waiting, {
          status: "connectFailed",
          failure: { code: failure.code, message: failure.message },
        });
      },
    );
  }

  private lookForShell(waiting: WaitingPane): void {
    const attempt = this.begin(waiting, { status: "lookingForShell" });
    const terminalId = waiting.terminalId;
    this.hosts.session(waiting.host, terminalId).then(
      (session) => {
        const info = this.remoteHosts.info(waiting.host);
        if (!this.isCurrent(waiting, attempt)) return;
        if (!info) {
          // Hung up while the answer was on its way.
          this.connect(waiting);
          return;
        }
        this.stop(terminalId);
        waiting.onFound({ session, os: info.os });
      },
      (error: unknown) => {
        if (!this.isCurrent(waiting, attempt)) return;
        if (isHostError(error, "sessionNotFound")) {
          this.setState(waiting, { status: "shellGone" });
        } else if (isHostError(error, "notConnected", "connectionLost")) {
          this.connect(waiting);
        } else {
          this.setState(waiting, { status: "noAnswer", message: toHostError(error).message });
        }
      },
    );
  }

  /** Starts an attempt in `state`; returns its number. */
  private begin(waiting: WaitingPane, state: WaitingPaneState): number {
    waiting.attempt += 1;
    this.setState(waiting, state);
    return waiting.attempt;
  }

  /** Whether the pane still waits, and for this attempt. */
  private isCurrent(waiting: WaitingPane, attempt: number): boolean {
    return this.waiting.get(waiting.terminalId) === waiting && waiting.attempt === attempt;
  }

  private setState(waiting: WaitingPane, state: WaitingPaneState): void {
    waiting.state = state;
    waiting.view?.setInput("state", state);
    waiting.view?.changeDetectorRef.detectChanges();
  }
}
