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

  /** How far each host's connection is, by host name; the current state first. */
  readonly connections$: Observable<ReadonlyMap<string, RemoteHostConnection>> =
    this.connections.asObservable();

  constructor(
    private readonly hosts: Hosts,
    private readonly pairing: PairingService,
    destroyRef: DestroyRef,
  ) {
    void hosts
      .onDisconnected((name) => this.onDisconnected(name))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
  }

  /** What a host said about itself, while its connection stands. */
  info(name: string): HostInfo | undefined {
    const connection = this.connections.value.get(name);
    return connection?.status === "connected" ? connection.info : undefined;
  }

  /**
   * Connects to the host unless the connection stands or is being set up.
   * Rejects with a `ConnectError`.
   */
  connect(name: string): Promise<HostInfo> {
    const known = this.info(name);
    if (known) return Promise.resolve(known);
    const underway = this.connecting.get(name);
    if (underway) return underway;

    if (!this.pairing.isKnown) {
      // At start a pane may ask before the paired machines are known.
      return this.pairing.known.then(() => this.connect(name));
    }
    if (!this.pairing.pairedNames.includes(name)) {
      const failure: ConnectFailure = {
        code: "notPaired",
        message: `This machine is not paired with '${name}'.`,
      };
      this.setConnection(name, { status: "failed", failure });
      return Promise.reject(new ConnectError(failure));
    }
    // Hung up in the meantime: what comes of this connection is no news.
    const isCurrent = () => this.connecting.get(name) === connecting;
    const connecting: Promise<HostInfo> = this.hosts
      .connect(name)
      .then((info) => {
        if (!isCurrent()) {
          throw new HostError("connectionLost", `The connection to ${name} was hung up.`);
        }
        this.setConnection(name, { status: "connected", info });
        return info;
      })
      .catch((rejection: unknown) => {
        const error = toHostError(rejection);
        const failure: ConnectFailure = { code: error.code, message: error.message };
        if (isCurrent()) this.setConnection(name, { status: "failed", failure });
        throw new ConnectError(failure);
      })
      .finally(() => {
        if (isCurrent()) this.connecting.delete(name);
      });
    this.connecting.set(name, connecting);
    this.setConnection(name, { status: "connecting" });
    return connecting;
  }

  /**
   * Hangs up on the host, or gives up connecting to it. The panes that show
   * its shells close here; the shells themselves run on.
   */
  async disconnect(name: string): Promise<void> {
    // Asked for: nothing was lost, so nothing is warned about.
    this.connecting.delete(name);
    this.setConnection(name, undefined);
    await this.hosts.disconnect(name);
  }

  private setConnection(name: string, connection: RemoteHostConnection | undefined): void {
    const next = new Map(this.connections.value);
    if (connection) {
      next.set(name, connection);
    } else {
      next.delete(name);
    }
    this.connections.next(next);
  }

  private onDisconnected(name: string): void {
    // Every window hears of it; only one that used the host has lost panes.
    if (!this.info(name)) return;
    this.setConnection(name, undefined);
    ErrorReporter.reportWarning({
      message: `The connection to ${name} was lost. Its terminals wait until it is back.`,
      notify: true,
      source: "RemoteHosts",
    });
  }
}
