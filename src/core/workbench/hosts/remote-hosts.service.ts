import { DestroyRef, Injectable } from "@angular/core";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { HostConnectionContract, HostInfo, Hosts } from "@cogno/platform/hosts";
import { BehaviorSubject, Observable } from "rxjs";

/** How far the connection to a host is; a host without an entry is not connected. */
export type RemoteHostConnection = HostConnectionContract;

/** Why a connection failed: a host's or the app's code, and words for the user. */
export type ConnectFailure = Extract<RemoteHostConnection, { status: "failed" }>["failure"];

/**
 * Whether connecting again could work after `failure`. Not to a machine
 * that is not paired with this one (any more): it has to be paired first.
 * After a version mismatch it can, once the older Cogno is updated.
 */
export function isWorthRetrying(failure: ConnectFailure): boolean {
  return failure.code !== "notPaired";
}

/**
 * The connections to the paired machines. A connection is set up when it is
 * asked for - by the user, or by a pane that shows a shell of that machine -
 * and stands until it breaks, is hung up or Cogno ends.
 *
 * The connections are the app's, one per machine for all its windows, and
 * so is how far each is: this window reads it again whenever the app says
 * it changed, and keeps nothing of its own.
 *
 * Nothing is installed there: Cogno only shows shells that run on the other
 * machine, started by the Cogno there with its own shell integration.
 */
@Injectable({ providedIn: "root" })
export class RemoteHostsService {
  private readonly connections = new BehaviorSubject<ReadonlyMap<string, RemoteHostConnection>>(
    new Map(),
  );
  /** Counts the reads: an answer counts only while it is the newest. */
  private reads = 0;

  /** How far each host's connection is, by the host's id; the current state first. */
  readonly connections$: Observable<ReadonlyMap<string, RemoteHostConnection>> =
    this.connections.asObservable();

  constructor(
    private readonly hosts: Hosts,
    destroyRef: DestroyRef,
  ) {
    void hosts
      .onConnectionsChanged(() => void this.read())
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void this.read();
  }

  /** What a host said about itself, while its connection stands. */
  info(id: string): HostInfo | undefined {
    const connection = this.connections.value.get(id);
    return connection?.status === "connected" ? { os: connection.os } : undefined;
  }

  /**
   * Connects to the host unless the connection stands; the app sets one up
   * once, however many ask. Rejects with a `HostError`.
   */
  async connect(id: string): Promise<HostInfo> {
    try {
      return await this.hosts.connect(id);
    } finally {
      // Known here once this returns, not only when the app's word arrives.
      await this.read();
    }
  }

  /**
   * Hangs up on the host, or gives up connecting to it, for every window.
   * The panes that show its shells close; the shells themselves run on.
   */
  async disconnect(id: string): Promise<void> {
    try {
      await this.hosts.disconnect(id);
    } finally {
      await this.read();
    }
  }

  private async read(): Promise<void> {
    const question = ++this.reads;
    let connections: ReadonlyMap<string, RemoteHostConnection>;
    try {
      connections = new Map(Object.entries(await this.hosts.connections()));
    } catch (error) {
      ErrorReporter.reportException({ error, handled: true, source: "RemoteHosts" });
      return;
    }
    if (question === this.reads) this.connections.next(connections);
  }
}
