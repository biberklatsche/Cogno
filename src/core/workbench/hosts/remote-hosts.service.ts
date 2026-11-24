import { DestroyRef, Injectable } from "@angular/core";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { PairingService } from "@cogno/core/workbench/hosts/pairing.service";
import { HostError, HostErrorCode, toHostError } from "@cogno/platform";
import { HostInfo, Hosts } from "@cogno/platform/hosts";
import { BehaviorSubject, Observable } from "rxjs";

/** Why a connection failed: a host's or the app's code. */
export type ConnectFailure = {
  readonly code: HostErrorCode;
  readonly message: string;
};

/**
 * Whether connecting again could work after `failure`. Not to a machine
 * that is not paired with this one (any more): it has to be paired first.
 * After a version mismatch it can, once the older Cogno is updated.
 */
export function isWorthRetrying(failure: ConnectFailure): boolean {
  return failure.code !== "notPaired";
}

/** How far the connection to a host is; a host without an entry is not connected. */
export type RemoteHostConnection =
  | { readonly status: "connecting" }
  | { readonly status: "connected"; readonly info: HostInfo }
  | { readonly status: "failed"; readonly failure: ConnectFailure };

/** `connect` failed; `failure` says why. */
export class ConnectError extends Error {
  constructor(readonly failure: ConnectFailure) {
    super(failure.message);
    this.name = "ConnectError";
  }
}

/**
 * The connections to the paired machines. A connection is set up when it is
 * asked for - by the user, or by a pane that shows a shell of that machine -
 * and stands until it breaks, is hung up or Cogno ends.
 *
 * Nothing is installed there: Cogno only shows shells that run on the other
 * machine, started by the Cogno there with its own shell integration.
 */
@Injectable({ providedIn: "root" })
export class RemoteHostsService {
  private readonly connecting = new Map<string, Promise<HostInfo>>();
  private readonly connections = new BehaviorSubject<ReadonlyMap<string, RemoteHostConnection>>(
    new Map(),
  );

  /** How far each host's connection is, by the host's id; the current state first. */
  readonly connections$: Observable<ReadonlyMap<string, RemoteHostConnection>> =
    this.connections.asObservable();

  constructor(
    private readonly hosts: Hosts,
    private readonly pairing: PairingService,
    destroyRef: DestroyRef,
  ) {
    void hosts
      .onDisconnected((id, lost) => this.onDisconnected(id, lost))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
  }

  /** What a host said about itself, while its connection stands. */
  info(id: string): HostInfo | undefined {
    const connection = this.connections.value.get(id);
    return connection?.status === "connected" ? connection.info : undefined;
  }

  /**
   * Connects to the host unless the connection stands or is being set up.
   * Rejects with a `ConnectError`.
   */
  connect(id: string): Promise<HostInfo> {
    const known = this.info(id);
    if (known) return Promise.resolve(known);
    const underway = this.connecting.get(id);
    if (underway) return underway;

    // Hung up in the meantime: what comes of this connection is no news.
    const isCurrent = () => this.connecting.get(id) === connecting;
    const connecting: Promise<HostInfo> = this.hosts
      .connect(id)
      .then((info) => {
        if (!isCurrent()) {
          throw new HostError("connectionLost", "The connection was hung up.");
        }
        this.setConnection(id, { status: "connected", info });
        return info;
      })
      .catch((rejection: unknown) => {
        const error = toHostError(rejection);
        const failure: ConnectFailure = { code: error.code, message: error.message };
        if (isCurrent()) this.setConnection(id, { status: "failed", failure });
        throw new ConnectError(failure);
      })
      .finally(() => {
        if (isCurrent()) this.connecting.delete(id);
      });
    this.connecting.set(id, connecting);
    this.setConnection(id, { status: "connecting" });
    return connecting;
  }

  /**
   * Hangs up on the host, or gives up connecting to it. The panes that show
   * its shells close here; the shells themselves run on.
   */
  async disconnect(id: string): Promise<void> {
    // Asked for: nothing was lost, so nothing is warned about.
    this.connecting.delete(id);
    this.setConnection(id, undefined);
    await this.hosts.disconnect(id);
  }

  private setConnection(id: string, connection: RemoteHostConnection | undefined): void {
    const next = new Map(this.connections.value);
    if (connection) {
      next.set(id, connection);
    } else {
      next.delete(id);
    }
    this.connections.next(next);
  }

  /**
   * The app's connection to the host ended, whichever window caused it:
   * this window must not go on believing that it stands.
   */
  private onDisconnected(id: string, lost: boolean): void {
    // Only a window that used the host has anything to forget, or to tell.
    if (!this.info(id)) return;
    this.setConnection(id, undefined);
    // Hung up on in another window: nothing was lost.
    if (!lost) return;
    const name = this.pairing.nameOf(id) ?? "the other machine";
    ErrorReporter.reportWarning({
      message: `The connection to ${name} was lost. Its terminals wait until it is back.`,
      notify: true,
      source: "RemoteHosts",
    });
  }
}
