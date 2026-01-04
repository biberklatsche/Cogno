import { Pipe, PipeTransform, NgZone, ChangeDetectorRef, OnDestroy } from '@angular/core';

/**
 * Pipe that shows the elapsed time since a given point in time (Time Ago).
 * The pipe is impure (pure: false) to allow for regular updates.
 */
@Pipe({
  name: 'timeAgo',
  pure: false, // Important: Makes the pipe impure so it runs on every Change Detection.
  standalone: true
})
export class TimeAgoPipe implements PipeTransform, OnDestroy {
  private lastValue: Date | null = null;
  private lastResult: string = '';
  private timer: number | null = null;

  // The update interval (in milliseconds) can vary depending on the duration.
  // We use a default update cycle for Change Detection.
  private updateIntervalMs: number = 60000; // Default: 1 minute

  constructor(
      private cdRef: ChangeDetectorRef,
      private ngZone: NgZone // Performs updates outside of Angular to improve performance
  ) {}

  transform(value: Date | string | number): string {
    if (value === this.lastValue) {
      // If the input value is unchanged, we return the last result,
      // until the timer manually triggers the Change Detector.
      return this.lastResult;
    }

    this.lastValue = value instanceof Date ? value : new Date(value);

    // Reset the timer when the input value (e.g., the timestamp) changes
    this.removeTimer();
    this.createTimer();

    this.lastResult = this.calculateTimeAgo(this.lastValue);
    return this.lastResult;
  }

  /**
   * Calculates the "Time Ago" display and determines the next update interval.
   */
  private calculateTimeAgo(date: Date): string {
    const now = Date.now();
    const then = date.getTime();
    const seconds = Math.round(Math.abs(now - then) / 1000);

    // Initialize update interval to 1 minute
    this.updateIntervalMs = 60000;

    // --- Seconds and "now" ---
    if (seconds < 60) {
      this.updateIntervalMs = 10000; // Update every 10 seconds
      return 'now';
    }

    // --- Minutes ---
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      this.updateIntervalMs = 30000; // Update every 30 seconds (or 1 minute)
      const roundedMinutes = Math.max(1, Math.round(minutes));
      return `${roundedMinutes} minute${roundedMinutes === 1 ? '' : 's'} ago`;
    }

    // --- Hours ---
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      this.updateIntervalMs = 3600000; // Update every hour
      const roundedHours = Math.max(1, Math.round(hours));
      return `${roundedHours} hour${roundedHours === 1 ? '' : 's'} ago`;
    }

    // --- Days ---
    const days = Math.round(hours / 24);
    if (days < 30) {
      this.updateIntervalMs = 21600000; // Update every 6 hours (or daily)
      const roundedDays = Math.max(1, Math.round(days));
      return `${roundedDays} day${roundedDays === 1 ? '' : 's'} ago`;
    }

    // --- Months ---
    const months = Math.round(days / 30.4);
    if (months < 12) {
      this.updateIntervalMs = 86400000; // Update daily
      const roundedMonths = Math.max(1, Math.round(months));
      return `${roundedMonths} month${roundedMonths === 1 ? '' : 's'} ago`;
    }

    // --- Years ---
    const years = Math.round(days / 365.25);
    const roundedYears = Math.max(1, Math.round(years));
    this.updateIntervalMs = 86400000; // Update daily
    return `${roundedYears} year${roundedYears === 1 ? '' : 's'} ago`;
  }

  /**
   * Creates a timer to trigger Change Detection after the calculated time.
   * Runs outside the Angular Zone (NgZone) for performance optimization.
   */
  private createTimer() {
    this.ngZone.runOutsideAngular(() => {
      this.timer = window.setTimeout(() => {
        // When the time has expired, we trigger Change Detection.
        this.ngZone.run(() => {
          this.lastValue = null; // Reset the last value to force the transform method to recalculate
          this.cdRef.markForCheck(); // Mark the component for check
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
