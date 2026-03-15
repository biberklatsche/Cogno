import {ErrorHandler, Injectable} from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private isShowing = false;

  constructor() {}

  handleError(error: unknown): void {
    try {
      const message = this.formatError(error);

      if (this.isShowing) {
        // eslint-disable-next-line no-console
        console.error('[GlobalErrorHandler] (suppressed while showing message):', error);
        return;
      }

      this.isShowing = true;
      setTimeout(() => {
        try {
          const header = 'Fehler in der Anwendung';
          const details = message.length > 4000 ? message.slice(0, 4000) + '…' : message;
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
