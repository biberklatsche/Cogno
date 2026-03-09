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
import {CoreHostWiringService} from "./core-host/core-host-wiring.service";
import {CoreHostSideMenuLifecycleRuntimeService} from "./core-host/core-host-side-menu-lifecycle-runtime.service";
import {TerminalSearchService} from "@cogno/open-features/terminal-search/terminal-search.service";
import {NotificationService} from "@cogno/open-features/notification/notification.service";
import {
    commandPaletteHostPortToken,
    databaseAccessToken,
    notificationHostPortToken,
    terminalSearchHostPortToken,
    workspaceHostPortToken
} from "@cogno/core-sdk";
import {TerminalSearchHostPortAdapterService} from "./core-host/terminal-search-host-port.adapter.service";
import {CommandPaletteHostPortAdapterService} from "./core-host/command-palette-host-port.adapter.service";
import {NotificationHostPortAdapterService} from "./core-host/notification-host-port.adapter.service";
import {WorkspaceHostPortAdapterService} from "./core-host/workspace-host-port.adapter.service";
import {WorkspaceHostApplicationService} from "./core-host/workspace-host-application.service";
import {DatabaseAccessHostService} from "./core-host/database-access-host.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
      { provide: commandPaletteHostPortToken, useExisting: CommandPaletteHostPortAdapterService },
      { provide: databaseAccessToken, useExisting: DatabaseAccessHostService },
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
