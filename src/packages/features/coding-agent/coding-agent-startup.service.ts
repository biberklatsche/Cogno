import { Injectable } from "@angular/core";
import {
  ApplicationConfigurationPort,
  ConfirmDialogPort,
  ICodingAgentProvider,
  OsPlatformPort,
} from "@cogno/core-api";
import { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";

@Injectable({ providedIn: "root" })
export class CodingAgentStartupService {
  constructor(
    private readonly registry: CodingAgentProviderRegistry,
    private readonly confirmDialog: ConfirmDialogPort,
    private readonly configPort: ApplicationConfigurationPort,
    private readonly osPort: OsPlatformPort,
  ) {
    void this.checkAndOfferInstallation();
  }

  private async checkAndOfferInstallation(): Promise<void> {
    const needsHooks: ICodingAgentProvider[] = [];

    for (const provider of this.registry.providers) {
      try {
        if (!(await provider.isAgentInstalled())) continue;
        if (!(await provider.isHookInstalled())) needsHooks.push(provider);
      } catch {
        // Provider config inaccessible — skip silently
      }
    }

    if (needsHooks.length === 0) return;

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
  }

  private resolveDefaultShellType(): string {
    const config = this.configPort.getConfiguration();
    const shell = config?.["shell"] as
      | { default?: string; profiles?: Record<string, { shell_type?: string }> }
      | undefined;
    const defaultName = shell?.default;
    const configured = defaultName ? shell?.profiles?.[defaultName]?.shell_type : undefined;
    if (configured) return configured;
    // No shell configured — fall back to OS: Windows defaults to PowerShell, others to Bash.
    return this.osPort.platform() === "windows" ? "PowerShell" : "Bash";
  }
}
