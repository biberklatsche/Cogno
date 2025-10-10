import {ApplicationConfig, ErrorHandler, inject, provideEnvironmentInitializer} from "@angular/core";
import {provideAnimations} from '@angular/platform-browser/animations';
import { GlobalErrorHandler } from './common/error/global-error.handler';
import {StyleService} from "./common/style/style.service";
import {Environment} from "./common/environment/environment";

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
      provideEnvironmentInitializer(() => {
          // erzwingt Instanziierung und startet die Subscription
          inject(StyleService);
      }),
  ],
};
