import { DestroyRef, Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ProcessPromptDispatcher } from "@cogno/core/infrastructure/process-prompt/process-prompt-dispatcher";
import { ProcessPromptService } from "@cogno/core/workbench/external/process-prompt.service";
import { HostInfo, Hosts } from "@cogno/platform/hosts";
import { BehaviorSubject, Observable } from "rxjs";
import { RunningSessionsService } from "./running-sessions.service";

/** How far the connection to a host is; a host without an entry is not connected. */
export type RemoteHostConnection =
  | { readonly status: "connecting" }
  | { readonly status: "connected"; readonly info: HostInfo }
  | { readonly status: "failed"; readonly reason: string };

/**
 * The connections to the machines of `remote.hosts`. A connection is set up
 * when it is asked for - by the user, or by a pane that shows a shell of
 * that machine - and stands until it breaks, is hung up or Cogno ends; what
 * ssh asks on the way (a password, a host key) is shown with the workbench's
 * plain prompt dialog. A host counts as connected once it said which shells
 * run there.
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
    private readonly runningSessions: RunningSessionsService,
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

  /** Connects to the host unless the connection stands or is being set up. */
  connect(name: string): Promise<HostInfo> {
    const known = this.info(name);
    if (known) return Promise.resolve(known);
    const underway = this.connecting.get(name);
    if (underway) return underway;

    const host = this.configService.config.remote?.hosts?.[name];
    if (!host) {
      return Promise.reject(new Error(`Host '${name}' is not defined in remote.hosts.`));
    }
    const promptSession = crypto.randomUUID();
    const forgetPrompts = this.prompts.register(promptSession, (prompt) =>
      this.promptDialog.ask(prompt),
    );
    // Hung up in the meantime: what comes of this connection is no news.
    const isCurrent = () => this.connecting.get(name) === connecting;
    const connecting: Promise<HostInfo> = this.hosts
      .connect(name, host.destination, host.command, promptSession)
      .then(async (info) => {
        await this.runningSessions.refresh(name);
        if (!isCurrent()) throw new Error(`The connection to ${name} was hung up.`);
        this.setConnection(name, { status: "connected", info });
        return info;
      })
      .catch((error) => {
        // The backend rejects with a plain text.
        const failure = error instanceof Error ? error : new Error(String(error));
        if (isCurrent()) this.setConnection(name, { status: "failed", reason: failure.message });
        throw failure;
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
   * Hangs up on the host. The panes that show its shells end here; the
   * shells themselves run on.
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
      message: `The connection to ${name} was lost. Its terminals were closed.`,
      notify: true,
      source: "RemoteHosts",
    });
  }
}
