import { DestroyRef, Injectable } from "@angular/core";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ConnectFailure, HostConnectionContract, HostInfo, Hosts } from "@cogno/platform/hosts";
import { BehaviorSubject, Observable } from "rxjs";

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
  private readonly connections = new BehaviorSubject<ReadonlyMap<string, HostConnectionContract>>(
    new Map(),
  );
  /** Counts the reads: an answer counts only while it is the newest. */
  private reads = 0;

  /** How far each host's connection is, by the host's id; the current state first. */
  readonly connections$: Observable<ReadonlyMap<string, HostConnectionContract>> =
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

  /**
   * Connects to the host unless the connection stands; the app sets one up
   * once, however many ask. Resolves with what the host says about itself;
   * rejects with a `HostError`.
   */
  connect(id: string): Promise<HostInfo> {
    return this.hosts.connect(id);
  }

  /**
   * Hangs up on the host, or gives up connecting to it, for every window.
   * The panes that show its shells close; the shells themselves run on.
   */
  disconnect(id: string): Promise<void> {
    return this.hosts.disconnect(id);
  }

  private async read(): Promise<void> {
    const question = ++this.reads;
    let connections: ReadonlyMap<string, HostConnectionContract>;
    try {
      connections = new Map(Object.entries(await this.hosts.connections()));
    } catch (error) {
      ErrorReporter.reportException({ error, handled: true, source: "RemoteHosts" });
      return;
    }
    if (question === this.reads) this.connections.next(connections);
  }
}
