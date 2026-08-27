import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Config } from "@cogno/core/infrastructure/config/models/config";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { ShellConfigurator } from "@cogno/core/session/shells/shell-configurator";
import { ShellIntegrationWriter } from "@cogno/core/session/shells/shell-integration.writer";
import { Opener } from "@cogno/platform/opener";
import { Hash } from "@cogno/shared/support";
import { ActionFired } from "../action/action.models";
import { AppBus } from "../app-bus/app-bus";

/**
 * MIGRATION-TEMP(step 19): everything the configuration used to do besides
 * reading its file.
 *
 * `ConfigService` now only reads, validates and watches (ARCHITECTURE.md 2.1:
 * infrastructure knows neither a session nor the layout). The three jobs it
 * lost live here until they reach their own layer:
 *
 * - action handling (`open_config`, `open_documentation`, `load_config`) goes
 *   to the workbench with the action catalogue in step 19,
 * - the notifications go to the notification dispatch, which subscribes to
 *   `diagnostics$` directly, in step 20,
 * - the shell bootstrap goes to `core/session/shells` in step 3, and the
 *   settings extensions come from the feature host in step 22.
 *
 * When the last of those has moved, this file goes away.
 */
@Injectable({ providedIn: "root" })
export class ConfigBootstrapAdapter {
  private lastDiagnosticsHash?: number;
  private isFirstLoad = true;

  constructor(
    private readonly appBus: AppBus,
    private readonly config: ConfigService,
    private readonly shells: ShellConfigurator,
    private readonly wiringService: AppWiringService,
    private readonly opener: Opener,
    private readonly environment: Environment,
    private readonly shellIntegration: ShellIntegrationWriter,
    destroyRef: DestroyRef,
  ) {
    this.appBus
      .onceType$("InitConfigCommand")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(async () => {
        await this.load();
      });

    this.appBus
      .on$(ActionFired.listener())
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(async (event) => {
        if (event.payload === "open_config") {
          await this.opener.openPath(this.environment.configFilePath());
        }
        if (event.payload === "open_documentation") {
          await this.opener.openUrl("https://cogno.rocks/docs/getting-started/");
        }
        if (event.payload === "load_config") {
          await this.config.reload();
        }
      });

    // Every load announces itself on the bus; every load but the first one -
    // watch or `load_config` - also shows a toast, as it did before the split.
    this.config.loaded$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      this.appBus.publish({ type: "ConfigLoaded", path: ["app", "settings"] });
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
    const shellSupportDefinitions = this.wiringService.getShellSupportDefinitions();
    await this.config.load({
      settingsExtensions: this.wiringService.getSettingsExtensions(),
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
      path: ["notification"],
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
      path: ["notification"],
      payload: {
        header,
        body,
        type: errors.length > 0 ? "error" : "warning",
      },
    });
  }
}
