import {
    ApplicationConfig,
    ErrorHandler,
    inject,
    provideEnvironmentInitializer,
    provideZonelessChangeDetection
} from "@angular/core";
import { GlobalErrorHandler } from './common/error/global-error.handler';
import {StyleService} from "./style/style.service";
import {WorkspaceService} from "./workspace/+state/workspace.service";
import {KeybindService} from "./keybinding/keybind.service";
import {CliActionService} from "./cli-command/cli-action.service";
import {NativeMenuService} from "./menu/native-menu/native-menu.service";
import {WindowService} from "./window/window.service";
import {NotificationService} from "./notification/+state/notification.service";
import {TelegramBotRelayService} from "./notification/+state/telegram-bot-relay.service";
import {CommandPaletteService} from "./command-palette/command-palette.service";
import {ConfigService, RealConfigService} from "./config/+state/config.service";
import {CoreHostWiringService} from "./core-host/core-host-wiring.service";
import {TerminalSearchService} from "@cogno/open-features/terminal-search/terminal-search.service";
import {terminalSearchHostPortToken} from "@cogno/core-sdk";
import {TerminalSearchHostPortAdapterService} from "./terminal-search-host/terminal-search-host-port.adapter.service";
import {TerminalSearchSideMenuHostService} from "./terminal-search-host/terminal-search-side-menu.host.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
      { provide: terminalSearchHostPortToken, useExisting: TerminalSearchHostPortAdapterService },
      provideZonelessChangeDetection(),
      provideEnvironmentInitializer(() => {
          inject(StyleService);
          inject(NotificationService);
          inject(TelegramBotRelayService);
          inject(WorkspaceService);
          inject(CommandPaletteService);
          inject(KeybindService);
          inject(CliActionService);
          inject(NativeMenuService);
          inject(WindowService);
          inject(CoreHostWiringService);
          inject(TerminalSearchHostPortAdapterService);
          inject(TerminalSearchService);
          inject(TerminalSearchSideMenuHostService);
      }),
  ],
};
