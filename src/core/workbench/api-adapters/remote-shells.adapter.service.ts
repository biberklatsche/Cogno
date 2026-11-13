import { Injectable } from "@angular/core";
import {
  RemoteHost,
  RemoteHostSettings,
  RemoteShell,
  RemoteShellsPort,
} from "@cogno/core/api/remote-shells-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { SessionHost, SessionRuntime } from "@cogno/core/session/host/session-host";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import {
  RemoteHostConnection,
  RemoteHostsService,
} from "@cogno/core/workbench/hosts/remote-hosts.service";
import { IdCreator } from "@cogno/core/workbench/id-creator";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { isHostError, SessionInfoContract } from "@cogno/platform";
import { Hosts } from "@cogno/platform/hosts";
import { TerminalId } from "@cogno/shared/domain";
import { combineLatest, defer, distinctUntilChanged, filter, map, merge, Observable } from "rxjs";
import { TerminalNavigatorAdapterService } from "./terminal-navigator.adapter.service";

/** A host name is a segment of a config key (`remote.hosts.<name>.…`). */
const HOST_NAME = /^[A-Za-z0-9_-]+$/;

function hostKeys(name: string): { destination: string; command: string } {
  return {
    destination: `remote.hosts.${name}.destination`,
    command: `remote.hosts.${name}.command`,
  };
}

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

function toRemoteShell(session: SessionInfoContract): RemoteShell {
  const { placement, attached } = session;
  return {
    terminalId: session.terminalId,
    workspace: placement.workspace ?? undefined,
    tab: placement.tab ?? undefined,
    title: placement.title ?? undefined,
    directory: placement.directory ?? undefined,
    shown: attached.to,
    shownBy: attached.to === "elsewhere" ? (attached.by ?? undefined) : undefined,
  };
}

function toRemoteHost(
  name: string,
  destination: string,
  command: string | undefined,
  connection: RemoteHostConnection | undefined,
): RemoteHost {
  return {
    name,
    destination,
    command,
    connection: connection?.status ?? "disconnected",
    failure: connection?.status === "failed" ? connection.failure.message : undefined,
  };
}

@Injectable({ providedIn: "root" })
export class RemoteShellsAdapterService extends RemoteShellsPort {
  readonly hosts$: Observable<readonly RemoteHost[]>;
  readonly shownHereChanged$: Observable<void>;

  constructor(
    private readonly configService: ConfigService,
    private readonly remoteHosts: RemoteHostsService,
    private readonly hosts: Hosts,
    private readonly sessionFactory: SessionHostFactory,
    sessions: TerminalSessionRegistry,
    private readonly gridList: GridListService,
    private readonly navigator: TerminalNavigatorAdapterService,
    private readonly bus: AppBus,
  ) {
    super();
    this.hosts$ = combineLatest([this.configService.config$, this.remoteHosts.connections$]).pipe(
      map(([config, connections]) =>
        Object.entries(config.remote?.hosts ?? {}).map(([name, host]) =>
          toRemoteHost(name, host.destination, host.command, connections.get(name)),
        ),
      ),
    );
    // A shell of another machine is shown here once its session runs, and
    // no longer once it is taken over or its session is gone. Shells of this
    // machine change nothing another machine says.
    this.shownHereChanged$ = merge(
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

  async saveHost(host: RemoteHostSettings, previousName?: string): Promise<void> {
    const name = host.name.trim();
    const destination = host.destination.trim();
    if (!HOST_NAME.test(name)) {
      throw new Error("A name consists of letters, digits, '-' and '_'.");
    }
    if (!destination) {
      throw new Error("A destination is needed: a host name, user@host or an ssh alias.");
    }
    const known = this.configService.config.remote?.hosts ?? {};
    if (name !== previousName && known[name]) {
      throw new Error(`There is a remote called '${name}' already.`);
    }
    const command = host.command?.trim() || undefined;
    const keys = hostKeys(name);
    const entries: Record<string, unknown> = {
      [keys.destination]: destination,
      [keys.command]: command,
    };
    const previous = previousName === undefined ? undefined : known[previousName];
    if (previousName !== undefined && previousName !== name) {
      const previousKeys = hostKeys(previousName);
      entries[previousKeys.destination] = undefined;
      entries[previousKeys.command] = undefined;
    }
    await this.configService.update(entries);
    if (
      previousName !== undefined &&
      (previousName !== name ||
        previous?.destination !== destination ||
        previous?.command !== command)
    ) {
      // What stands was set up with what no longer holds.
      await this.remoteHosts.disconnect(previousName);
    }
  }

  async removeHost(host: string): Promise<void> {
    const keys = hostKeys(host);
    await this.configService.update({ [keys.destination]: undefined, [keys.command]: undefined });
    await this.remoteHosts.disconnect(host);
  }

  defaultCommand(): Promise<string> {
    return this.hosts.defaultCommand();
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
    // The new pane asks the host for its shell itself.
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
