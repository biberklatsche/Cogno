import { Injectable } from "@angular/core";
import { RemoteHost, RemoteShell, RemoteShellsPort } from "@cogno/core/api/remote-shells-port";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { SessionHost, SessionRuntime } from "@cogno/core/session/host/session-host";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import { PairingService } from "@cogno/core/workbench/hosts/pairing.service";
import {
  isWorthRetrying,
  RemoteHostConnection,
  RemoteHostsService,
} from "@cogno/core/workbench/hosts/remote-hosts.service";
import { shownByOtherCogno } from "@cogno/core/workbench/hosts/running-shell";
import { IdCreator } from "@cogno/core/workbench/id-creator";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { isHostError, PairedMachineContract, Pairing, SeenSessionContract } from "@cogno/platform";
import { Hosts } from "@cogno/platform/hosts";
import { TerminalId } from "@cogno/shared/domain";
import { combineLatest, defer, distinctUntilChanged, filter, map, merge, Observable } from "rxjs";
import { TerminalNavigatorAdapterService } from "./terminal-navigator.adapter.service";

/** Whether a session shows a shell of another machine. */
function isRemote(entry: { readonly host: SessionHost } | undefined): boolean {
  return entry?.host.state.shellContext.host !== undefined;
}

/** Fires whenever a session that showed a shell of another machine is gone. */
function remoteSessionsGone(sessions: TerminalSessionRegistry): Observable<void> {
  const remoteIds = () =>
    new Set(sessions.entries.filter(isRemote).map(({ terminalId }) => terminalId));
  return defer(() => {
    let remote = remoteIds();
    return sessions.changes$.pipe(
      filter(() => {
        const before = remote;
        remote = remoteIds();
        return [...before].some((terminalId) => !remote.has(terminalId));
      }),
    );
  });
}

/** The runtimes at which a window begins or stops showing a shell it has a session for. */
const SHOWING_CHANGES: readonly SessionRuntime["status"][] = ["running", "takenOver"];

/** Where `session` is shown, from this window's side. */
function shownWhere(session: SeenSessionContract): RemoteShell["shown"] {
  switch (session.attached.to) {
    case "nowhere":
      return "nowhere";
    case "thisClient":
      return session.shownInThisWindow ? "thisWindow" : "otherWindow";
    default:
      return "otherCogno";
  }
}

function toRemoteShell(session: SeenSessionContract): RemoteShell {
  const { placement, attached } = session;
  return {
    terminalId: session.terminalId,
    workspace: placement.workspace ?? undefined,
    tab: placement.tab ?? undefined,
    title: placement.title ?? undefined,
    directory: placement.directory ?? undefined,
    shown: shownWhere(session),
    shownBy: shownByOtherCogno(attached),
  };
}

/** The paired machine `machine`, and how far the connection to it is. */
function toRemoteHost(
  machine: PairedMachineContract,
  connection: RemoteHostConnection | undefined,
): RemoteHost {
  return {
    id: machine.endpointId,
    name: machine.name,
    connection: connection?.status ?? "disconnected",
    failure:
      connection?.status === "failed"
        ? {
            message: connection.failure.message,
            worthRetrying: isWorthRetrying(connection.failure),
          }
        : undefined,
  };
}

@Injectable({ providedIn: "root" })
export class RemoteShellsAdapterService extends RemoteShellsPort {
  readonly hosts$: Observable<readonly RemoteHost[]>;
  readonly shownInThisWindowChanged$: Observable<void>;

  constructor(
    private readonly remoteHosts: RemoteHostsService,
    private readonly pairingService: PairingService,
    private readonly pairing: Pairing,
    private readonly hosts: Hosts,
    private readonly sessionFactory: SessionHostFactory,
    private readonly sessions: TerminalSessionRegistry,
    private readonly gridList: GridListService,
    private readonly navigator: TerminalNavigatorAdapterService,
    private readonly bus: AppBus,
  ) {
    super();
    this.hosts$ = combineLatest([
      this.pairingService.machines$,
      this.remoteHosts.connections$,
    ]).pipe(
      map(([machines, connections]): RemoteHost[] =>
        machines.map((machine) => toRemoteHost(machine, connections.get(machine.endpointId))),
      ),
    );
    // A shell of another machine is shown here once its session runs, and
    // no longer once it is taken over or its session is gone. Shells of this
    // machine change nothing another machine says.
    this.shownInThisWindowChanged$ = merge(
      sessions.runtimes$.pipe(
        filter(
          ({ terminalId, runtime }) =>
            SHOWING_CHANGES.includes(runtime.status) && isRemote(sessions.get(terminalId)),
        ),
        distinctUntilChanged(
          (before, after) =>
            before.terminalId === after.terminalId &&
            before.runtime.status === after.runtime.status,
        ),
      ),
      remoteSessionsGone(sessions),
    ).pipe(map(() => undefined));
  }

  async renameHost(host: string, name: string): Promise<void> {
    const renamed = name.trim();
    if (renamed === "") throw new Error("A remote needs a name.");
    if (renamed === this.pairingService.nameOf(host)) return;
    // Two remotes of one name could not be told apart in the panel.
    if (this.pairingService.pairedNames.includes(renamed)) {
      throw new Error(`There is a remote called '${renamed}' already.`);
    }
    await this.pairing.rename(host, renamed);
  }

  /**
   * Removes the pairing here; the other machine hears of it when it can be
   * reached. When not, it learns of it when it connects next time.
   */
  async removeHost(host: string): Promise<void> {
    // The panes of its shells close here; the shells run on there.
    const name = this.pairingService.labelOf(host);
    await this.remoteHosts.disconnect(host);
    if (await this.pairing.remove(host)) return;
    ErrorReporter.reportWarning({
      message: `Removed ${name} here, but ${name} could not be reached to remove this machine too. It is refused the next time it connects and can remove this machine then.`,
      notify: true,
      source: "RemoteHosts",
    });
  }

  async connect(host: string): Promise<void> {
    await this.remoteHosts.connect(host);
  }

  disconnect(host: string): Promise<void> {
    return this.remoteHosts.disconnect(host);
  }

  async shells(host: string): Promise<readonly RemoteShell[]> {
    return (await this.hosts.sessions(host)).map(toRemoteShell);
  }

  async show(host: string, terminalId: TerminalId): Promise<void> {
    if (await this.sessionFactory.takeBack(terminalId)) return;
    if (this.gridList.findTabIdByTerminalId(terminalId)) {
      await this.navigator.navigateToTerminal(terminalId);
      return;
    }
    // The new pane asks the host for its shell itself, and takes it from
    // whoever shows it: the user asked for it here.
    this.sessionFactory.takeOverWhenOpened(terminalId);
    this.bus.publish({
      type: "CreateTab",
      payload: { tabId: IdCreator.newTabId(), terminalId, host, isActive: true },
    });
  }

  async end(host: string, terminalId: TerminalId): Promise<void> {
    try {
      await this.hosts.killSession(host, terminalId);
    } catch (error) {
      // Ended already: what was asked for is done.
      if (!isHostError(error, "sessionNotFound")) throw error;
    }
  }
}
