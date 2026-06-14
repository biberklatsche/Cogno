import { Injectable, Signal, signal } from "@angular/core";
import {
  ApplicationConfigurationPort,
  ConfirmDialogPort,
  ICodingAgentProvider,
  OsPlatformPort,
} from "@cogno/core-api";
import { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";

export type InstalledProviderEntry = {
  readonly provider: ICodingAgentProvider;
  readonly hasHook: boolean;
};

@Injectable({ providedIn: "root" })
export class CodingAgentStartupService {
  private readonly _installedProviders = signal<ReadonlyArray<InstalledProviderEntry>>([]);
  private readonly _isScanning = signal(false);

  readonly installedProviders: Signal<ReadonlyArray<InstalledProviderEntry>> =
    this._installedProviders.asReadonly();
  readonly isScanning: Signal<boolean> = this._isScanning.asReadonly();

  constructor(
    private readonly registry: CodingAgentProviderRegistry,
    private readonly confirmDialog: ConfirmDialogPort,
    private readonly configPort: ApplicationConfigurationPort,
    private readonly osPort: OsPlatformPort,
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
        if (!hasHook) needsHooks.push(provider);
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

  private async offerHookInstallation(needsHooks: ICodingAgentProvider[]): Promise<void> {
    const names = needsHooks.map((p) => p.name).join(", ");
    const confirmed = await this.confirmDialog
      .confirm(
        "Coding agents found",
        `${names} ${needsHooks.length === 1 ? "was" : "were"} found. Install hooks to monitor agent status?`,
      )
      .catch(() => false);

    if (!confirmed) return;

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

  private isEnabled(): boolean {
    const config = this.configPort.getConfiguration() as { coding_agents?: { mode?: string } };
    return config?.coding_agents?.mode !== "off";
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
