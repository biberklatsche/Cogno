import { Component } from "@angular/core";
import { Database, DatabaseRecoveryReport } from "@cogno/app-tauri/database";
import { DB } from "@cogno/app-tauri/db";
import { OS } from "@cogno/app-tauri/os";
import { AppBus } from "./app-bus/app-bus";
import { AppButtonsComponent } from "./app-buttons/app-buttons.component";
import { DatabaseMigrationService } from "./app-host/database-migration.service";
import { BusyIndicatorService } from "./common/busy-indicator/busy-indicator.service";
import { Environment } from "./common/environment/environment";
import { ErrorReporter } from "./common/error/error-reporter";
import { GridListComponent } from "./grid-list/grid-list.component";
import { SelectedWorkspaceHeaderComponent } from "./header/selected-workspace-header.component";
import { appDatabaseMigrations } from "./migrations/migrate";
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
        <app-notification-toast-stack></app-notification-toast-stack>
    </main>
    `,
  styles: [
    `
            :host {
                display: flex;
                flex-direction: column;
                --header-height: 34px;
                overflow: hidden;
                height: 100vh;
                width: 100vw;
            }

            header {
                height: var(--header-height);
                display: flex;
                flex-direction: row;
                justify-content: flex-start;
                align-items: center;
                overflow: hidden;
                max-width: 100vw;
                &.space-left-window-buttons {
                    padding-left: 70px;
                }
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
  os = OS.platform();
  constructor(
    bus: AppBus,
    private readonly databaseMigrationService: DatabaseMigrationService,
    _busyIndicatorService: BusyIndicatorService,
    _terminalBusyIndicatorAdapter: TerminalBusyIndicatorAdapterService,
  ) {
    window.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    bus.onceType$("ConfigLoaded").subscribe(async (_e) => {
      await this.openApplicationDatabase(bus);
      await DB.load(`sqlite:${Environment.dbFilePath()}`);
      await this.databaseMigrationService.executeMigrations(appDatabaseMigrations);
      bus.publish({ type: "DBInitialized" });
    });
  }

  /**
   * Opens the Rust-owned application database. A file that failed its
   * integrity check is rebuilt on the Rust side; the user gets told what was
   * recovered rather than finding silently missing data.
   */
  private async openApplicationDatabase(bus: AppBus): Promise<void> {
    try {
      const report = await Database.open(Environment.isDevMode(), []);
      if (report.recovery) {
        bus.publish({
          type: "Notification",
          path: ["notification"],
          payload: {
            body: describeRecovery(report.recovery),
            header: "Datenbank wiederhergestellt",
            source: "Database",
            timestamp: new Date(),
            type: "warning",
          },
        });
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
