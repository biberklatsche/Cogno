import { ApplicationConfig, ErrorHandler } from "@angular/core";
import {provideAnimations} from '@angular/platform-browser/animations';
import { GlobalErrorHandler } from './common/error/global-error.handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
