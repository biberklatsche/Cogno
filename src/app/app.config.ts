import {ApplicationConfig, ErrorHandler, inject, provideEnvironmentInitializer} from "@angular/core";
import {provideAnimations} from '@angular/platform-browser/animations';
import { GlobalErrorHandler } from './common/error/global-error.handler';
import {StyleService} from "./common/style/style.service";
import {Environment} from "./common/environment/environment";
import {WorkspaceService} from "./workspace/+state/workspace.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
      provideEnvironmentInitializer(() => {
          // erzwingt Instanziierung des StyleService
          inject(StyleService);
          inject(WorkspaceService);
      }),
  ],
};
