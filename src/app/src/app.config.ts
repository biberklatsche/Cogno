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
import {ConfigService, RealConfigService} from "./config/+state/config.service";
import {CoreHostWiringService} from "./core-host/core-host-wiring.service";
import {CoreHostSideMenuLifecycleRuntimeService} from "./core-host/core-host-side-menu-lifecycle-runtime.service";
import {TerminalSearchService} from "@cogno/open-features/terminal-search/terminal-search.service";
import {commandPaletteHostPortToken, terminalSearchHostPortToken} from "@cogno/core-sdk";
import {TerminalSearchHostPortAdapterService} from "./core-host/terminal-search-host-port.adapter.service";
import {CommandPaletteHostPortAdapterService} from "./core-host/command-palette-host-port.adapter.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
      { provide: commandPaletteHostPortToken, useExisting: CommandPaletteHostPortAdapterService },
      { provide: terminalSearchHostPortToken, useExisting: TerminalSearchHostPortAdapterService },
      provideZonelessChangeDetection(),
      provideEnvironmentInitializer(() => {
          inject(StyleService);
          inject(NotificationService);
          inject(TelegramBotRelayService);
          inject(WorkspaceService);
          inject(KeybindService);
          inject(CliActionService);
          inject(NativeMenuService);
          inject(WindowService);
          inject(CoreHostWiringService);
          inject(CoreHostSideMenuLifecycleRuntimeService);
          inject(CommandPaletteHostPortAdapterService);
          inject(TerminalSearchHostPortAdapterService);
          inject(TerminalSearchService);
      }),
  ],
};
