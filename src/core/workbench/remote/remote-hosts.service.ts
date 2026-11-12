import { DestroyRef, Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ProcessPromptDispatcher } from "@cogno/core/infrastructure/process-prompt/process-prompt-dispatcher";
import { ShellIntegrationWriter } from "@cogno/core/session/shells/shell-integration.writer";
import { ProcessPromptService } from "@cogno/core/workbench/external/process-prompt.service";
import { FeatureHost } from "@cogno/core/workbench/feature-host/feature-host";
import { HostInfo, Hosts } from "@cogno/platform/hosts";
import { RunningSessionsService } from "./running-sessions.service";

/**
 * The connections to the machines of `remote.hosts`. A connection is set up
 * when the first shell on that machine is wanted and stands until it breaks
 * or Cogno ends; what ssh asks on the way (a password, a host key) is shown
 * with the workbench's plain prompt dialog. A host counts as connected once
 * it has this Cogno's shell integration, so a shell started there finds it.
 */
@Injectable({ providedIn: "root" })
export class RemoteHostsService {
  private readonly connected = new Map<string, HostInfo>();
  private readonly connecting = new Map<string, Promise<HostInfo>>();

  constructor(
    private readonly hosts: Hosts,
    private readonly configService: ConfigService,
    private readonly prompts: ProcessPromptDispatcher,
    private readonly promptDialog: ProcessPromptService,
    private readonly shellIntegration: ShellIntegrationWriter,
    private readonly featureHost: FeatureHost,
    private readonly runningSessions: RunningSessionsService,
    destroyRef: DestroyRef,
  ) {
    void hosts
      .onDisconnected((name) => this.onDisconnected(name))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
  }

  /** What a host said about itself, while its connection stands. */
  info(name: string): HostInfo | undefined {
    return this.connected.get(name);
  }

  /** Connects to the host unless the connection stands or is being set up. */
  connect(name: string): Promise<HostInfo> {
    const known = this.connected.get(name);
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
    const connecting = this.hosts
      .connect(name, host.destination, host.command, promptSession)
      .then(
        async (info) => {
          await this.shellIntegration.ensure(this.featureHost.getShellSupportDefinitions(), name);
          await this.runningSessions.refresh(name);
          this.connected.set(name, info);
          return info;
        },
        // The backend rejects with a plain text.
        (error) => {
          throw error instanceof Error ? error : new Error(String(error));
        },
      )
      .finally(() => {
        forgetPrompts();
        this.connecting.delete(name);
      });
    this.connecting.set(name, connecting);
    return connecting;
  }

  private onDisconnected(name: string): void {
    // Every window hears of it; only one that used the host has lost panes.
    if (!this.connected.delete(name)) return;
    ErrorReporter.reportWarning({
      message: `The connection to ${name} was lost. Its terminals were closed.`,
      notify: true,
      source: "RemoteHosts",
    });
  }
}
