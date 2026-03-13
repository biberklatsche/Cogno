import type { ApplicationConfig } from "@angular/core";
import {
  ErrorHandler,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from "@angular/core";
import { CliActionService } from "@cogno/app-shell/cli-command/cli-action.service";
import { GlobalErrorHandler } from "@cogno/app-shell/common/error/global-error.handler";
import { ConfigService, RealConfigService } from "@cogno/app-shell/config/+state/config.service";
import { KeybindService } from "@cogno/app-shell/keybinding/keybind.service";
import { NativeMenuService } from "@cogno/app-shell/menu/native-menu/native-menu.service";
import { TelegramBotRelayService } from "@cogno/app-shell/notification/+state/telegram-bot-relay.service";
import { StyleService } from "@cogno/app-shell/style/style.service";
import { WindowService } from "@cogno/app-shell/window/window.service";
import { NotificationService } from "@cogno/base-features/side-menu/notification/notification.service";
import { TerminalSearchService } from "@cogno/base-features/side-menu/terminal-search/terminal-search.service";
import {
  commandPaletteHostPortToken,
  commandRunnerToken,
  databaseAccessToken,
  filesystemToken,
  notificationHostPortToken,
  terminalSearchHostPortToken,
  workspaceHostPortToken,
} from "@cogno/core-sdk";
import { CommandPaletteHostPortAdapterService } from "@cogno/app-shell/app-host/command-palette-host-port.adapter.service";
import { CommandRunnerHostService } from "@cogno/app-shell/app-host/command-runner-host.service";
import { CoreHostSideMenuLifecycleRuntimeService } from "@cogno/app-shell/app-host/core-host-side-menu-lifecycle-runtime.service";
import { DatabaseAccessHostService } from "@cogno/app-shell/app-host/database-access-host.service";
import { FilesystemHostService } from "@cogno/app-shell/app-host/filesystem-host.service";
import { NotificationHostPortAdapterService } from "@cogno/app-shell/app-host/notification-host-port.adapter.service";
import { TerminalSearchHostPortAdapterService } from "@cogno/app-shell/app-host/terminal-search-host-port.adapter.service";
import { WorkspaceHostApplicationService } from "@cogno/app-shell/app-host/workspace-host-application.service";
import { WorkspaceHostPortAdapterService } from "@cogno/app-shell/app-host/workspace-host-port.adapter.service";
import { CoreHostWiringService } from "./app-host/core-host-wiring.service";

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
      inject(CoreHostWiringService);
      inject(CoreHostSideMenuLifecycleRuntimeService);
      inject(CommandPaletteHostPortAdapterService);
      inject(NotificationHostPortAdapterService);
      inject(TerminalSearchHostPortAdapterService);
      inject(WorkspaceHostPortAdapterService);
      inject(TerminalSearchService);
    }),
  ],
};
