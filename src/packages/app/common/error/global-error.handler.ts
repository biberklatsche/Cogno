import { ErrorHandler, Injectable } from "@angular/core";
import { ErrorReporter } from "./error-reporter";

@Injectable({ providedIn: "root" })
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    ErrorReporter.reportException({
      error,
      handled: false,
      source: "GlobalErrorHandler",
    });
  }
}
