import { Component } from "@angular/core";
import { DB } from "@cogno/app-tauri/db";
import { OS } from "@cogno/app-tauri/os";
import { AppBus } from "./app-bus/app-bus";
import { AppButtonsComponent } from "./app-buttons/app-buttons.component";
import { DatabaseMigrationService } from "./app-host/database-migration.service";
import { BusyIndicatorService } from "./common/busy-indicator/busy-indicator.service";
import { Environment } from "./common/environment/environment";
import { GridListComponent } from "./grid-list/grid-list.component";
import { SelectedWorkspaceHeaderComponent } from "./header/selected-workspace-header.component";
import { appDatabaseMigrations } from "./migrations/migrate";
import { AppNotificationToastStackComponent } from "./notification/app-notification-toast-stack.component";
import { TabListComponent } from "./tab-list/tab-list.component";
import { TerminalBusyIndicatorAdapterService } from "./terminal/terminal-busy-indicator-adapter.service";
import { UpdateAvailableButtonComponent } from "./updater/update-available-button.component";

@Component({
  selector: "app-root",
  imports: [
    GridListComponent,
    AppButtonsComponent,
    TabListComponent,
    AppNotificationToastStackComponent,
    SelectedWorkspaceHeaderComponent,
    UpdateAvailableButtonComponent,
  ],
  template: `
    <header [class.space-left-window-buttons]="os === 'macos'">
        <app-tab-list></app-tab-list>
        <app-selected-workspace-header></app-selected-workspace-header>
        <app-update-available-button></app-update-available-button>
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
      await DB.load(`sqlite:${Environment.dbFilePath()}`);
      await this.databaseMigrationService.executeMigrations(appDatabaseMigrations);
      bus.publish({ type: "DBInitialized" });
    });
  }
}
