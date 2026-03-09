import {ErrorHandler, Injectable} from '@angular/core';

// Minimal global error handler that shows a message window whenever an uncaught error occurs.
// Uses a dependency-free alert() to satisfy the requirement without pulling UI libs.
// You can later replace alert() with a custom dialog/toast component if desired.
@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private isShowing = false;

  constructor() {}

  handleError(error: unknown): void {
    try {
      const message = this.formatError(error);

      // Avoid spamming multiple alerts if error loops or multiple errors fire in the same tick
      if (this.isShowing) {
        // eslint-disable-next-line no-console
        console.error('[GlobalErrorHandler] (suppressed while showing message):', error);
        return;
      }

      this.isShowing = true;
      // Use setTimeout to ensure it runs outside Angular's error throwing frame
      setTimeout(() => {
        try {
          // Localized basic header in German as per issue language
          const header = 'Fehler in der Anwendung';
          const details = message.length > 4000 ? message.slice(0, 4000) + '…' : message; // guard overly long
          // Using native alert for minimal footprint
          // eslint-disable-next-line no-alert
          alert(`${header}\n\n${details}`);
        } finally {
          this.isShowing = false;
        }
      });
    } catch (fallback) {
      // eslint-disable-next-line no-console
      console.error('[GlobalErrorHandler] Failed to show error message', fallback, 'original:', error);
    }

    // Still log the original error to the console for debugging
    // eslint-disable-next-line no-console
    console.error(error);
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return `${err.name}: ${err.message}` + (err.stack ? `\n\nStacktrace:\n${err.stack}` : '');
    }
    if (typeof err === 'string') return err;

    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return String(err);
    }
  }
}
