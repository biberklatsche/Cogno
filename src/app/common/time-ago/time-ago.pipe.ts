import { Pipe, PipeTransform, NgZone, ChangeDetectorRef, OnDestroy } from '@angular/core';

/**
 * Pipe, die die verstrichene Zeit seit einem gegebenen Zeitpunkt anzeigt (Time Ago).
 * Die Pipe ist unrein (pure: false), um eine regelmäßige Aktualisierung zu ermöglichen.
 */
@Pipe({
  name: 'timeAgo',
  pure: false, // Wichtig: Macht die Pipe unrein, sodass sie bei jeder Change Detection neu läuft.
  standalone: true
})
export class TimeAgoPipe implements PipeTransform, OnDestroy {
  private lastValue: Date | null = null;
  private lastResult: string = '';
  private timer: number | null = null;

  // Der Aktualisierungsintervall (in Millisekunden) kann je nach Dauer variieren.
  // Wir verwenden einen Standard-Update-Zyklus für die Change Detection.
  private updateIntervalMs: number = 60000; // Standard: 1 Minute

  constructor(
      private cdRef: ChangeDetectorRef,
      private ngZone: NgZone // Führt Updates außerhalb von Angular aus, um die Performance zu verbessern
  ) {}

  transform(value: Date | string | number): string {
    if (value === this.lastValue) {
      // Wenn der Eingabewert unverändert ist, geben wir das letzte Ergebnis zurück,
      // bis der Timer den Change Detector manuell triggert.
      return this.lastResult;
    }

    this.lastValue = value instanceof Date ? value : new Date(value);

    // Setzt den Timer neu, wenn der Eingabewert (z.B. der Zeitstempel) sich ändert
    this.removeTimer();
    this.createTimer();

    this.lastResult = this.calculateTimeAgo(this.lastValue);
    return this.lastResult;
  }

  /**
   * Berechnet die "Time Ago" Angabe und bestimmt das nächste Update-Intervall.
   */
  private calculateTimeAgo(date: Date): string {
    const now = Date.now();
    const then = date.getTime();
    const seconds = Math.round(Math.abs(now - then) / 1000);

    // Initialisiere das Update-Intervall auf 1 Minute
    this.updateIntervalMs = 60000;

    // --- Sekunden und "now" ---
    if (seconds < 60) {
      this.updateIntervalMs = 10000; // Update alle 10 Sekunden
      return 'now';
    }

    // --- Minuten ---
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      this.updateIntervalMs = 30000; // Update alle 30 Sekunden (oder 1 Minute)
      const roundedMinutes = Math.max(1, Math.round(minutes));
      return `${roundedMinutes} minute${roundedMinutes === 1 ? '' : 's'} ago`;
    }

    // --- Stunden ---
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      this.updateIntervalMs = 3600000; // Update jede Stunde
      const roundedHours = Math.max(1, Math.round(hours));
      return `${roundedHours} hour${roundedHours === 1 ? '' : 's'} ago`;
    }

    // --- Tage ---
    const days = Math.round(hours / 24);
    if (days < 30) {
      this.updateIntervalMs = 21600000; // Update alle 6 Stunden (oder täglich)
      const roundedDays = Math.max(1, Math.round(days));
      return `${roundedDays} day${roundedDays === 1 ? '' : 's'} ago`;
    }

    // --- Monate ---
    const months = Math.round(days / 30.4);
    if (months < 12) {
      this.updateIntervalMs = 86400000; // Update täglich
      const roundedMonths = Math.max(1, Math.round(months));
      return `${roundedMonths} month${roundedMonths === 1 ? '' : 's'} ago`;
    }

    // --- Jahre ---
    const years = Math.round(days / 365.25);
    const roundedYears = Math.max(1, Math.round(years));
    this.updateIntervalMs = 86400000; // Update täglich
    return `${roundedYears} year${roundedYears === 1 ? '' : 's'} ago`;
  }

  /**
   * Erstellt einen Timer, um die Change Detection nach der berechneten Zeit zu triggern.
   * Läuft außerhalb der Angular Zone (NgZone) zur Performance-Optimierung.
   */
  private createTimer() {
    this.ngZone.runOutsideAngular(() => {
      this.timer = window.setTimeout(() => {
        // Wenn die Zeit abgelaufen ist, triggern wir die Change Detection.
        this.ngZone.run(() => {
          this.lastValue = null; // Setze den letzten Wert zurück, um die Transform-Methode zu zwingen, neu zu rechnen
          this.cdRef.markForCheck(); // Markiere die Komponente zur Überprüfung
        });
      }, this.updateIntervalMs);
    });
  }

  private removeTimer() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy(): void {
    this.removeTimer();
  }
}
