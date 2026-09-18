import { Injectable, Signal, signal } from "@angular/core";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { ICodingAgentProvider } from "@cogno/features/coding-agent/ports";
import { OsPlatform } from "@cogno/platform";
import { ApplicationConfigurationPort } from "@cogno/shared/ports";
import { CodingAgentConfirmDialogService } from "./coding-agent-confirm-dialog.service";
import { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";

export type InstalledProviderEntry = {
  readonly provider: ICodingAgentProvider;
  readonly hasHook: boolean;
};

/**
 * Where the user said no to a hook, or took one out again. Cogno offers the
 * hook once per agent; after that the panel is the place to change one's mind.
 */
const HOOK_DECISIONS_STORAGE_KEY = "cogno.coding-agents.hook-decisions";
type HookDecision = "declined" | "removed";

@Injectable({ providedIn: "root" })
export class CodingAgentStartupService {
  private readonly _installedProviders = signal<ReadonlyArray<InstalledProviderEntry>>([]);
  private readonly _isScanning = signal(false);

  readonly installedProviders: Signal<ReadonlyArray<InstalledProviderEntry>> =
    this._installedProviders.asReadonly();
  readonly isScanning: Signal<boolean> = this._isScanning.asReadonly();

  constructor(
    private readonly registry: CodingAgentProviderRegistry,
    private readonly confirmDialog: CodingAgentConfirmDialogService,
    private readonly configPort: ApplicationConfigurationPort,
    private readonly osPort: OsPlatform,
    private readonly notificationCenterPort: NotificationCenterPort,
  ) {
    if (!this.isEnabled()) return;
    void this.rescan();
  }

  async rescan(): Promise<void> {
    if (this._isScanning()) return;
    this._isScanning.set(true);

    const needsHooks: ICodingAgentProvider[] = [];
    const installed: InstalledProviderEntry[] = [];

    for (const provider of this.registry.providers) {
      try {
        if (!(await provider.isAgentInstalled())) continue;
        const hasHook = await provider.isHookInstalled();
        installed.push({ provider, hasHook });
        if (!hasHook && !this.decisionFor(provider)) needsHooks.push(provider);
      } catch {
        // Provider config inaccessible — skip silently
      }
    }

    this._installedProviders.set(installed);
    this._isScanning.set(false);

    if (needsHooks.length > 0) {
      await this.offerHookInstallation(needsHooks);
    }
  }

  /** Installs the hook from the panel; a "no" or a removal from before no longer counts. */
  async installHook(provider: ICodingAgentProvider): Promise<void> {
    await this.changeHook(provider, "install", async () => {
      await provider.installHook(this.resolveDefaultShellType());
      this.rememberDecision(provider, undefined);
    });
  }

  /** Takes the Cogno hook out of the agent's config; Cogno will not offer it again. */
  async removeHook(provider: ICodingAgentProvider): Promise<void> {
    await this.changeHook(provider, "remove", async () => {
      await provider.removeHook();
      this.rememberDecision(provider, "removed");
    });
  }

  /** Runs the change, then rescans; a failing provider becomes a notification. */
  private async changeHook(
    provider: ICodingAgentProvider,
    verb: "install" | "remove",
    change: () => Promise<void>,
  ): Promise<void> {
    try {
      await change();
    } catch (error) {
      this.notificationCenterPort.dispatch({
        header: `Could not ${verb} the ${provider.name} hook`,
        body: error instanceof Error ? error.message : String(error),
        type: "error",
        timestamp: new Date(),
      });
      return;
    }
    await this.rescan();
  }

  private async offerHookInstallation(needsHooks: ICodingAgentProvider[]): Promise<void> {
    const names = needsHooks.map((p) => p.name).join(", ");
    const confirmed = await this.confirmDialog
      .confirm(
        "Coding agents found",
        `${names} ${needsHooks.length === 1 ? "was" : "were"} found. Install hooks to monitor agent status?`,
      )
      .catch(() => false);

    if (!confirmed) {
      for (const provider of needsHooks) this.rememberDecision(provider, "declined");
      return;
    }

    const shellType = this.resolveDefaultShellType();
    for (const provider of needsHooks) {
      try {
        await provider.installHook(shellType);
      } catch (err) {
        console.error(`[coding-agent] Failed to install hook for ${provider.name}:`, err);
      }
    }

    await this.rescan();
  }

  private decisionFor(provider: ICodingAgentProvider): HookDecision | undefined {
    return this.readDecisions()[provider.id];
  }

  private rememberDecision(
    provider: ICodingAgentProvider,
    decision: HookDecision | undefined,
  ): void {
    const decisions = this.readDecisions();
    if (decision) {
      decisions[provider.id] = decision;
    } else {
      delete decisions[provider.id];
    }
    try {
      window.localStorage.setItem(HOOK_DECISIONS_STORAGE_KEY, JSON.stringify(decisions));
    } catch {
      // No storage (private window, blocked site data): the offer simply repeats.
    }
  }

  private readDecisions(): Record<string, HookDecision> {
    try {
      const raw = window.localStorage.getItem(HOOK_DECISIONS_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, HookDecision>)
        : {};
    } catch {
      return {};
    }
  }

  private isEnabled(): boolean {
    const config = this.configPort.getConfiguration() as {
      feature?: { coding_agents?: { mode?: string } };
    };
    return config?.feature?.coding_agents?.mode !== "off";
  }

  private resolveDefaultShellType(): string {
    const config = this.configPort.getConfiguration();
    const shell = config?.["shell"] as
      | { default?: string; profiles?: Record<string, { shell_type?: string }> }
      | undefined;
    const defaultName = shell?.default;
    const configured = defaultName ? shell?.profiles?.[defaultName]?.shell_type : undefined;
    if (configured) return configured;
    return this.osPort.platform() === "windows" ? "PowerShell" : "Bash";
  }
}
