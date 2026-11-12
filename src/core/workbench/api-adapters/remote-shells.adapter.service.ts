import { Injectable } from "@angular/core";
import {
  RemoteHost,
  RemoteHostSettings,
  RemoteShell,
  RemoteShellsPort,
} from "@cogno/core/api/remote-shells-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { IdCreator } from "@cogno/core/workbench/id-creator";
import {
  RemoteHostConnection,
  RemoteHostsService,
} from "@cogno/core/workbench/remote/remote-hosts.service";
import { RunningSessionsService } from "@cogno/core/workbench/remote/running-sessions.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { Hosts, RunningSession } from "@cogno/platform/hosts";
import { TerminalId } from "@cogno/shared/domain";
import { combineLatest, map, Observable } from "rxjs";
import { TerminalNavigatorAdapterService } from "./terminal-navigator.adapter.service";

/** A host name is a segment of a config key (`remote.hosts.<name>.…`). */
const HOST_NAME = /^[A-Za-z0-9_-]+$/;

function hostKeys(name: string): { destination: string; command: string } {
  return {
    destination: `remote.hosts.${name}.destination`,
    command: `remote.hosts.${name}.command`,
  };
}

function toRemoteShell(session: RunningSession): RemoteShell {
  return {
    terminalId: session.terminalId,
    workspace: session.label.workspace ?? undefined,
    tab: session.label.tab ?? undefined,
    title: session.label.title ?? undefined,
    directory: session.label.directory ?? undefined,
    shown: session.attached,
    shownHere: session.shownHere,
    shownBy: session.shownBy ?? undefined,
  };
}

@Injectable({ providedIn: "root" })
export class RemoteShellsAdapterService extends RemoteShellsPort {
  readonly hosts$: Observable<readonly RemoteHost[]>;

  constructor(
    private readonly configService: ConfigService,
    private readonly remoteHosts: RemoteHostsService,
    private readonly runningSessions: RunningSessionsService,
    private readonly hosts: Hosts,
    private readonly sessions: TerminalSessionRegistry,
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

  async removeHost(name: string): Promise<void> {
    const keys = hostKeys(name);
    await this.configService.update({ [keys.destination]: undefined, [keys.command]: undefined });
    await this.remoteHosts.disconnect(name);
  }

  async connect(name: string): Promise<void> {
    await this.remoteHosts.connect(name);
  }

  disconnect(name: string): Promise<void> {
    return this.remoteHosts.disconnect(name);
  }

  async shells(host: string | undefined): Promise<readonly RemoteShell[]> {
    return (await this.hosts.sessions(host)).map(toRemoteShell);
  }

  async open(host: string | undefined, terminalId: TerminalId): Promise<void> {
    if (this.sessions.get(terminalId)?.host.runtime.status === "takenOver") {
      this.bus.publish({ type: "RetakeTerminal", payload: terminalId });
      return;
    }
    if (this.gridList.findTabIdByTerminalId(terminalId)) {
      await this.navigator.navigateToTerminal(terminalId);
      return;
    }
    // The new pane takes its shell from what the host says runs there: that
    // has to be what runs now, not what ran when the host was last asked.
    await this.runningSessions.refresh(host);
    this.bus.publish({
      type: "CreateTab",
      payload: { tabId: IdCreator.newTabId(), terminalId, host, isActive: true },
    });
  }

  end(host: string | undefined, terminalId: TerminalId): Promise<void> {
    return this.hosts.endSession(host, terminalId);
  }
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
    failure: connection?.status === "failed" ? connection.reason : undefined,
  };
}
