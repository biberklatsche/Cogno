import { DestroyRef, Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { remoteHostKeys } from "@cogno/core/infrastructure/config/models/remote-config";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ProcessPromptDispatcher } from "@cogno/core/infrastructure/process-prompt/process-prompt-dispatcher";
import { ProcessPromptService } from "@cogno/core/workbench/external/process-prompt.service";
import { HostError, HostErrorCode, toHostError } from "@cogno/platform";
import { HostInfo, Hosts } from "@cogno/platform/hosts";
import { BehaviorSubject, Observable } from "rxjs";

/**
 * Why a connection failed: a host's or the app's code, or `notConfigured`
 * for a name that `remote.hosts` does not define.
 */
export type ConnectFailureCode = HostErrorCode | "notConfigured";

export type ConnectFailure = {
  readonly code: ConnectFailureCode;
  readonly message: string;
};

/**
 * Failures that trying again cannot mend: the settings have to change first.
 * After a version mismatch it can, once the older Cogno is updated.
 */
const SETTINGS_FAILURES: readonly ConnectFailureCode[] = ["notConfigured", "invalidDestination"];

/** Whether connecting again could work after `failure`. */
export function isWorthRetrying(failure: ConnectFailure): boolean {
  return !SETTINGS_FAILURES.includes(failure.code);
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
 * The connections to the machines of `remote.hosts`. A connection is set up
 * when it is asked for - by the user, or by a pane that shows a shell of
 * that machine - and stands until it breaks, is hung up or Cogno ends; what
 * ssh asks on the way (a password, a host key) is shown with the workbench's
 * plain prompt dialog.
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
    private readonly configService: ConfigService,
    private readonly prompts: ProcessPromptDispatcher,
    private readonly promptDialog: ProcessPromptService,
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

    const host = this.configService.config.remote?.hosts?.[name];
    if (!host) {
      const failure: ConnectFailure = {
        code: "notConfigured",
        message: `Host '${name}' is not defined in remote.hosts.`,
      };
      this.setConnection(name, { status: "failed", failure });
      return Promise.reject(new ConnectError(failure));
    }
    const promptSession = crypto.randomUUID();
    const forgetPrompts = this.prompts.register(promptSession, (prompt) =>
      this.promptDialog.ask(prompt),
    );
    // Hung up in the meantime: what comes of this connection is no news.
    const isCurrent = () => this.connecting.get(name) === connecting;
    const connecting: Promise<HostInfo> = this.hosts
      .connect(name, host.destination, host.command, promptSession)
      .then((info) => {
        if (!isCurrent()) {
          throw new HostError("connectionLost", `The connection to ${name} was hung up.`);
        }
        this.setConnection(name, { status: "connected", info });
        if (info.foundCommand) this.rememberCommand(name, info.foundCommand);
        return info;
      })
      .catch((rejection: unknown) => {
        const error = toHostError(rejection);
        const failure: ConnectFailure = { code: error.code, message: error.message };
        if (isCurrent()) this.setConnection(name, { status: "failed", failure });
        throw new ConnectError(failure);
      })
      .finally(() => {
        forgetPrompts();
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

  /**
   * The remote names no command, and the one that reached Cogno there was
   * not the default: it goes to the config, so the next connection takes it
   * at once instead of trying - and asking for a password - twice.
   */
  private rememberCommand(name: string, command: string): void {
    this.configService.update({ [remoteHostKeys(name).command]: command }).catch((error) =>
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "RemoteHosts",
        context: { operation: "rememberCommand", host: name },
      }),
    );
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
