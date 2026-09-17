import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Config } from "@cogno/core/infrastructure/config/models/config";
import { ShellConfigurator } from "@cogno/core/session/shells/shell-configurator";
import { ShellIntegrationWriter } from "@cogno/core/session/shells/shell-integration.writer";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { FeatureHost } from "@cogno/core/workbench/feature-host/feature-host";
import { Hash } from "@cogno/shared/support";

/**
 * Orchestrates config bootstrap: on `InitConfigCommand` it loads the config -
 * applying shell defaults and writing the shell integration through
 * `core/session/shells` - then announces `ConfigLoaded` on the bus and turns the
 * config's diagnostics into notifications. `ConfigService` itself only reads,
 * validates and watches (ARCHITECTURE.md 2.1); this ties that to the shells,
 * the feature settings and the bus.
 */
@Injectable({ providedIn: "root" })
export class ConfigBootstrapAdapter {
  private lastDiagnosticsHash?: number;
  private isFirstLoad = true;

  constructor(
    private readonly appBus: AppBus,
    private readonly config: ConfigService,
    private readonly shells: ShellConfigurator,
    private readonly featureHost: FeatureHost,
    private readonly shellIntegration: ShellIntegrationWriter,
    destroyRef: DestroyRef,
  ) {
    this.appBus
      .once$("InitConfigCommand")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(async () => {
        await this.load();
      });

    // Every load announces itself on the bus; every load but the first one -
    // watch or `load_config` - also shows a toast, as it did before the split.
    this.config.loaded$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      this.appBus.publish({ type: "ConfigLoaded" });
      if (this.isFirstLoad) {
        this.isFirstLoad = false;
        return;
      }
      this.notifyLoaded();
    });

    this.config.diagnostics$.pipe(takeUntilDestroyed(destroyRef)).subscribe((diagnostics) => {
      this.notifyDiagnostics(diagnostics);
    });
  }

  private async load(): Promise<void> {
    const shellSupportDefinitions = this.featureHost.getShellSupportDefinitions();
    await this.config.load({
      settingsExtensions: this.featureHost.getSettingsExtensions(),
      completeDefaults: async (config: Config) => {
        if (Object.keys(config.shell?.profiles ?? {}).length > 0) {
          return false;
        }
        await this.shells.apply(config, shellSupportDefinitions);
        return true;
      },
      beforeWatch: async () => {
        await this.shellIntegration.ensure(shellSupportDefinitions);
      },
    });
  }

  private notifyLoaded(): void {
    this.appBus.publish({
      type: "Notification",
      payload: { header: "System", body: "Config loaded" },
    });
  }

  private notifyDiagnostics(diagnostics: ReadonlyArray<{ level: string; message: string }>): void {
    if (diagnostics.length === 0) {
      this.lastDiagnosticsHash = undefined;
      return;
    }

    const diagnosticsHash = Hash.create(JSON.stringify(diagnostics));
    if (this.lastDiagnosticsHash === diagnosticsHash) {
      return;
    }
    this.lastDiagnosticsHash = diagnosticsHash;

    const errors = diagnostics.filter((d) => d.level === "error");
    const warnings = diagnostics.filter((d) => d.level === "warning");
    const header = errors.length > 0 ? "Config errors" : "Config warnings";
    const lines: string[] = [];
    if (errors.length > 0) lines.push(`Errors: ${errors.length}`);
    if (warnings.length > 0) lines.push(`Warnings: ${warnings.length}`);
    const detailLines = diagnostics.slice(0, 6).map((d) => `- ${d.message}`);
    if (diagnostics.length > 6) {
      detailLines.push(`- ...and ${diagnostics.length - 6} more`);
    }
    const body = [...lines, ...detailLines].join("\n");
    this.appBus.publish({
      type: "Notification",
      payload: {
        header,
        body,
        type: errors.length > 0 ? "error" : "warning",
      },
    });
  }
}
