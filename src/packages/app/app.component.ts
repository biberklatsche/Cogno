import { Component } from "@angular/core";
import { DatabaseMigrationService } from "@cogno/core/infrastructure/database/database-migration.service";
import { appDatabaseMigrations } from "@cogno/core/infrastructure/database/migrate";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { DatabaseOpenReport, DatabaseRecoveryReport } from "@cogno/platform/database";
import { OsPlatform, OsType } from "@cogno/platform/os";
import { AppBus } from "./app-bus/app-bus";
import { AppButtonsComponent } from "./app-buttons/app-buttons.component";
import { BusyIndicatorService } from "./common/busy-indicator/busy-indicator.service";
import { GridListComponent } from "./grid-list/grid-list.component";
import { SelectedWorkspaceHeaderComponent } from "./header/selected-workspace-header.component";
import { AppNotificationToastStackComponent } from "./notification/app-notification-toast-stack.component";
import { TabListComponent } from "./tab-list/tab-list.component";
import { TerminalBusyIndicatorAdapterService } from "./terminal/terminal-busy-indicator-adapter.service";

@Component({
  selector: "app-root",
  imports: [
    GridListComponent,
    AppButtonsComponent,
    TabListComponent,
    AppNotificationToastStackComponent,
    SelectedWorkspaceHeaderComponent,
  ],
  template: `
    <header [class.space-left-window-buttons]="os === 'macos'">
        <app-tab-list></app-tab-list>
        <app-selected-workspace-header></app-selected-workspace-header>
        <app-window-buttons></app-window-buttons>
    </header>
    <main>
        <app-grid-list></app-grid-list>
    </main>
    <app-notification-toast-stack></app-notification-toast-stack>
  `,
  styles: [
    `
            :host {
                /* Read by header, main, the tab list and the window buttons.
                   Without it every calc() using it is invalid, and main
                   collapses to its content height. */
                --header-height: 34px;
                display: block;
                height: 100vh;
                width: 100vw;
                overflow: hidden;
            }

            header {
                display: flex;
                align-items: center;
                height: var(--header-height);
                -webkit-app-region: drag;
                app-region: drag;
            }

            header.space-left-window-buttons {
                padding-left: 70px;
            }

            main {
                width: 100vw;
                height: calc(100vh - var(--header-height));
                display: flex;
                flex-direction: column;
            }
        `,
  ],
  standalone: true,
})
export class AppComponent {
  os: OsType;
  constructor(
    os: OsPlatform,
    private readonly environment: Environment,
    bus: AppBus,
    private readonly databaseMigrationService: DatabaseMigrationService,
    _busyIndicatorService: BusyIndicatorService,
    _terminalBusyIndicatorAdapter: TerminalBusyIndicatorAdapterService,
  ) {
    this.os = os.platform();
    window.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    bus.onceType$("ConfigLoaded").subscribe(async (_e) => {
      await this.openApplicationDatabase(bus);
      bus.publish({ type: "DBInitialized" });
    });
  }

  /**
   * Opens the application database. A file that failed its integrity check
   * is rebuilt on the Rust side; the user gets told what was recovered (or
   * what an import could not bring over) rather than finding data missing.
   */
  private async openApplicationDatabase(bus: AppBus): Promise<void> {
    try {
      const report = await this.databaseMigrationService.openDatabase(
        appDatabaseMigrations,
        this.environment.isDevMode(),
        this.environment.legacyDatabaseFilePath(),
      );
      if (report.recovery) {
        publishDatabaseWarning(
          bus,
          "Datenbank wiederhergestellt",
          describeRecovery(report.recovery),
        );
      }
      if (report.legacyErrors.length > 0) {
        publishDatabaseWarning(bus, "Import unvollständig", describeLegacyErrors(report));
      }
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        notify: true,
        source: "Database",
        context: { operation: "open" },
      });
    }
  }
}

function publishDatabaseWarning(bus: AppBus, header: string, body: string): void {
  bus.publish({
    type: "Notification",
    path: ["notification"],
    payload: {
      body,
      header,
      source: "Database",
      timestamp: new Date(),
      type: "warning",
    },
  });
}

function describeRecovery(recovery: DatabaseRecoveryReport): string {
  const restored = recovery.tables.reduce((sum, table) => sum + table.rowsRestored, 0);
  const failed = recovery.tables.filter((table) => table.error !== null).map((table) => table.name);
  const lines = [
    `Die Datenbank war beschädigt (${recovery.reasons[0] ?? "unbekannt"}).`,
    `${restored} Zeilen wiederhergestellt. Die beschädigte Datei liegt unter ${recovery.quarantinedPath}.`,
  ];
  if (failed.length > 0) {
    lines.push(`Nicht lesbar: ${failed.join(", ")}.`);
  }
  return lines.join("\n");
}

function describeLegacyErrors(report: DatabaseOpenReport): string {
  const lines = report.legacyErrors.map((entry) => `${entry.id}: ${entry.error}`);
  return ["Daten aus der vorherigen Datenbank konnten nicht übernommen werden:", ...lines].join(
    "\n",
  );
}
