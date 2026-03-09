import {
    ApplicationConfig,
    ErrorHandler,
    inject,
    provideEnvironmentInitializer,
    provideZonelessChangeDetection
} from "@angular/core";
import { GlobalErrorHandler } from './common/error/global-error.handler';
import {StyleService} from "./style/style.service";
import {KeybindService} from "./keybinding/keybind.service";
import {CliActionService} from "./cli-command/cli-action.service";
import {NativeMenuService} from "./menu/native-menu/native-menu.service";
import {WindowService} from "./window/window.service";
import {TelegramBotRelayService} from "./notification/+state/telegram-bot-relay.service";
import {ConfigService, RealConfigService} from "./config/+state/config.service";
import {CoreHostWiringService} from "./app-host/core-host-wiring.service";
import {CoreHostSideMenuLifecycleRuntimeService} from "./app-host/core-host-side-menu-lifecycle-runtime.service";
import {TerminalSearchService} from "@cogno/open-features/terminal-search/terminal-search.service";
import {NotificationService} from "@cogno/open-features/notification/notification.service";
import {
    commandPaletteHostPortToken,
    databaseAccessToken,
    filesystemToken,
    notificationHostPortToken,
    terminalSearchHostPortToken,
    workspaceHostPortToken
} from "@cogno/core-sdk";
import {TerminalSearchHostPortAdapterService} from "./app-host/terminal-search-host-port.adapter.service";
import {CommandPaletteHostPortAdapterService} from "./app-host/command-palette-host-port.adapter.service";
import {NotificationHostPortAdapterService} from "./app-host/notification-host-port.adapter.service";
import {WorkspaceHostPortAdapterService} from "./app-host/workspace-host-port.adapter.service";
import {WorkspaceHostApplicationService} from "./app-host/workspace-host-application.service";
import {DatabaseAccessHostService} from "./app-host/database-access-host.service";
import { FilesystemHostService } from "./app-host/filesystem-host.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
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
