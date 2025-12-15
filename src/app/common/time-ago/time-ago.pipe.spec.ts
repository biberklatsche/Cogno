import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeAgoPipe } from './time-ago.pipe';
import { NgZone, ChangeDetectorRef } from '@angular/core';

// --- Mocks ---

// Mock für NgZone: Führt run/runOutsideAngular sofort aus, um die Logik zu testen
const mockNgZone = {
  run: vi.fn(fn => fn()),
  runOutsideAngular: vi.fn(fn => fn()),
};

// Mock für ChangeDetectorRef: Überwacht, ob die Pipe das Update triggert
const mockCdRef = {
  markForCheck: vi.fn(),
};

// --- Test-Suite ---

describe('TimeAgoPipe (Simplified Unit Test)', () => {
  let pipe: TimeAgoPipe;
  let clock: ReturnType<typeof vi.useFakeTimers>;

  // Wir verwenden Date.now() als Basis für alle Zeitberechnungen
  const NOW = Date.now();

  beforeEach(() => {
    // Manuelle Instanziierung der Pipe mit den Mocks
    pipe = new TimeAgoPipe(
        mockCdRef as unknown as ChangeDetectorRef, // Mocks als die erwarteten Typen übergeben
        mockNgZone as unknown as NgZone
    );

    // Fake-Timer für die Zeitsteuerung aktivieren
    clock = vi.useFakeTimers();
    vi.setSystemTime(NOW); // Setzt die aktuelle Zeit auf einen festen Wert
  });

  afterEach(() => {
    pipe.ngOnDestroy();
    clock.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- Test-Suite für die "Time Ago"-Berechnung ---

  it('should return "now" for times less than 60 seconds ago', () => {
    const time = new Date(NOW - 30 * 1000); // 30 Sekunden her
    expect(pipe.transform(time)).toBe('now');
  });

  it('should return "1 minute ago" for times between 60 and 90 seconds ago', () => {
    const time = new Date(NOW - 75 * 1000); // 1 Minute 15 Sekunden her
    expect(pipe.transform(time)).toBe('1 minute ago');
  });

  it('should return correct rounded hours (e.g., 10 hours ago)', () => {
    const time = new Date(NOW - 10 * 3600 * 1000 - 1000); // 10 Stunden her
    expect(pipe.transform(time)).toBe('10 hours ago');
  });

  it('should return correct rounded years (e.g., 2 years ago)', () => {
    const time = new Date(NOW - 2 * 365 * 24 * 3600 * 1000 - 1000);
    expect(pipe.transform(time)).toBe('2 years ago');
  });

  // --- Test-Suite für die Timer-Logik ---

  it('should set up a timer and mark for check after appropriate delay (e.g., 1 minute)', () => {
    const time = new Date(NOW - 5 * 60 * 1000); // 5 Minuten alt
    pipe.transform(time);

    // Nach 5 Minuten wird das Update-Intervall auf 60000ms gesetzt.

    // 1. Initial sollte noch nicht markiert sein
    expect(mockCdRef.markForCheck).not.toHaveBeenCalled();

    // 2. Simuliere das Warten auf den Timer
    clock.advanceTimersByTime(60001);

    // 3. Nach dem Timer sollte die Change Detection getriggert werden
    expect(mockCdRef.markForCheck).toHaveBeenCalled();

    // 4. Prüfe, ob der Timer außerhalb der Angular Zone gestartet wurde
    expect(mockNgZone.runOutsideAngular).toHaveBeenCalled();
  });

  it('should restart the timer and update interval if the input value changes', () => {
    // 1. Erster Aufruf: 'now', Timer auf 10s
    const time1 = new Date(NOW - 5 * 1000);
    expect(pipe.transform(time1)).toBe('now');

    // 2. Timer um 5s vorspulen (Timer ist noch nicht abgelaufen)
    clock.advanceTimersByTime(5000);

    // 3. Zweiter Aufruf mit neuem, altem Zeitstempel: '1 minute ago', Timer auf 60s
    const time2 = new Date(NOW - 70 * 1000);
    expect(pipe.transform(time2)).toBe('1 minute ago');

    // Der alte Timer (10s) sollte gelöscht und ein neuer (60s) gestartet sein.
    // Wir spulen 5s vor (gesamte verstrichene Zeit seit time1: 10s)
    clock.advanceTimersByTime(5000);

    // Die CD sollte NOCH NICHT getriggert werden, da der neue 60s-Timer noch läuft
    expect(mockCdRef.markForCheck).not.toHaveBeenCalled();

    // Spulen wir 55s weiter (gesamt 60s, neuer Timer ist abgelaufen)
    clock.advanceTimersByTime(55001);

    // Jetzt sollte die CD getriggert werden
    expect(mockCdRef.markForCheck).toHaveBeenCalled();
  });
});
