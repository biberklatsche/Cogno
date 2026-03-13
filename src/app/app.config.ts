import type { ApplicationConfig } from "@angular/core";
import {
  ErrorHandler,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from "@angular/core";
import { CliActionService } from "@cogno/workbench/cli-command/cli-action.service";
import { GlobalErrorHandler } from "@cogno/workbench/common/error/global-error.handler";
import { ConfigService, RealConfigService } from "@cogno/workbench/config/+state/config.service";
import { KeybindService } from "@cogno/workbench/keybinding/keybind.service";
import { NativeMenuService } from "@cogno/workbench/menu/native-menu/native-menu.service";
import { TelegramBotRelayService } from "@cogno/workbench/notification/+state/telegram-bot-relay.service";
import { StyleService } from "@cogno/workbench/style/style.service";
import { WindowService } from "@cogno/workbench/window/window.service";
import { NotificationService } from "@cogno/features/side-menu/notification/notification.service";
import { TerminalSearchService } from "@cogno/features/side-menu/terminal-search/terminal-search.service";
import {
  commandPaletteHostPortToken,
  commandRunnerToken,
  databaseAccessToken,
  filesystemToken,
  notificationHostPortToken,
  terminalSearchHostPortToken,
  workspaceHostPortToken,
} from "@cogno/core-sdk";
import { CommandPaletteHostPortAdapterService } from "@cogno/workbench/app-host/command-palette-host-port.adapter.service";
import { CommandRunnerHostService } from "@cogno/workbench/app-host/command-runner-host.service";
import { SideMenuLifecycleRuntimeService } from "@cogno/workbench/app-host/side-menu-lifecycle-runtime.service";
import { DatabaseAccessHostService } from "@cogno/workbench/app-host/database-access-host.service";
import { FilesystemHostService } from "@cogno/workbench/app-host/filesystem-host.service";
import { NotificationHostPortAdapterService } from "@cogno/workbench/app-host/notification-host-port.adapter.service";
import { TerminalSearchHostPortAdapterService } from "@cogno/workbench/app-host/terminal-search-host-port.adapter.service";
import { WorkspaceHostApplicationService } from "@cogno/workbench/app-host/workspace-host-application.service";
import { WorkspaceHostPortAdapterService } from "@cogno/workbench/app-host/workspace-host-port.adapter.service";
import { AppWiringService } from "./app-host/app-wiring.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
    { provide: commandRunnerToken, useExisting: CommandRunnerHostService },
    { provide: commandPaletteHostPortToken, useExisting: CommandPaletteHostPortAdapterService },
    { provide: databaseAccessToken, useExisting: DatabaseAccessHostService },
    { provide: filesystemToken, useExisting: FilesystemHostService },
    { provide: notificationHostPortToken, useExisting: NotificationHostPortAdapterService },
    { provide: terminalSearchHostPortToken, useExisting: TerminalSearchHostPortAdapterService },
    { provide: workspaceHostPortToken, useExisting: WorkspaceHostPortAdapterService },
    provideZonelessChangeDetection(),
    provideEnvironmentInitializer(() => {
      inject(StyleService);
      inject(NotificationService);
      inject(TelegramBotRelayService);
      inject(WorkspaceHostApplicationService);
      inject(KeybindService);
      inject(CliActionService);
      inject(NativeMenuService);
      inject(WindowService);
      inject(AppWiringService);
      inject(SideMenuLifecycleRuntimeService);
      inject(CommandPaletteHostPortAdapterService);
      inject(NotificationHostPortAdapterService);
      inject(TerminalSearchHostPortAdapterService);
      inject(WorkspaceHostPortAdapterService);
      inject(TerminalSearchService);
    }),
  ],
};
