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
import {CliCommandService} from "./cli-command/cli-command.service";
import {WindowMenuService} from "./menu/window-menu.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
      provideZonelessChangeDetection(),
      provideEnvironmentInitializer(() => {
          // erzwingt Instanziierung des StyleService
          inject(StyleService);
          inject(WorkspaceService);
          inject(KeybindService);
          inject(CliCommandService);
          inject(WindowMenuService);
      }),
  ],
};
