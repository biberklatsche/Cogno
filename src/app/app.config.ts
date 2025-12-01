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
import {ScrollbarService} from "./style/scrollbar.service";
import {InspectorService} from "./inspector/+state/inspector.service";
import {NotificationService} from "./notification/+state/notification.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
      provideZonelessChangeDetection(),
      provideEnvironmentInitializer(() => {
          // erzwingt Instanziierung des StyleService
          inject(StyleService);
          inject(NotificationService);
          inject(WorkspaceService);
          inject(InspectorService);
          inject(KeybindService);
          inject(CliActionService);
          inject(NativeMenuService);
          inject(WindowService);
          // initialize ScrollbarService at app startup
          inject(ScrollbarService);
      }),
  ],
};
