import { Injectable, signal } from "@angular/core";

/**
 * Where the settings panel should stand when it is asked for by key:
 * `open_settings notification` leaves the top-level key here, the panel takes
 * it and shows that section. It is taken once, so opening the settings the
 * plain way afterwards starts where it always does.
 */
@Injectable({ providedIn: "root" })
export class SettingsNavigation {
  private readonly requested = signal<string | undefined>(undefined);
  /** The top-level key asked for and not yet shown. */
  readonly requestedKey = this.requested.asReadonly();

  request(key: string): void {
    this.requested.set(key);
  }

  taken(): void {
    this.requested.set(undefined);
  }
}
