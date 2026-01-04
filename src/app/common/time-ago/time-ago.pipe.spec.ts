import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeAgoPipe } from './time-ago.pipe';
import { NgZone, ChangeDetectorRef } from '@angular/core';

// --- Mocks ---

// Mock for NgZone: Executes run/runOutsideAngular immediately to test the logic
const mockNgZone = {
  run: vi.fn(fn => fn()),
  runOutsideAngular: vi.fn(fn => fn()),
};

// Mock for ChangeDetectorRef: Monitors if the pipe triggers the update
const mockCdRef = {
  markForCheck: vi.fn(),
};

// --- Test Suite ---

describe('TimeAgoPipe (Simplified Unit Test)', () => {
  let pipe: TimeAgoPipe;
  let clock: ReturnType<typeof vi.useFakeTimers>;

  // We use Date.now() as the base for all time calculations
  const NOW = Date.now();

  beforeEach(() => {
    // Manual instantiation of the pipe with mocks
    pipe = new TimeAgoPipe(
        mockCdRef as unknown as ChangeDetectorRef, // Pass mocks as expected types
        mockNgZone as unknown as NgZone
    );

    // Activate fake timers for time control
    clock = vi.useFakeTimers();
    vi.setSystemTime(NOW); // Sets current time to a fixed value
  });

  afterEach(() => {
    pipe.ngOnDestroy();
    clock.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- Test Suite for "Time Ago" calculation ---

  it('should return "now" for times less than 60 seconds ago', () => {
    const time = new Date(NOW - 30 * 1000); // 30 seconds ago
    expect(pipe.transform(time)).toBe('now');
  });

  it('should return "1 minute ago" for times between 60 and 90 seconds ago', () => {
    const time = new Date(NOW - 75 * 1000); // 1 minute 15 seconds ago
    expect(pipe.transform(time)).toBe('1 minute ago');
  });

  it('should return correct rounded hours (e.g., 10 hours ago)', () => {
    const time = new Date(NOW - 10 * 3600 * 1000 - 1000); // 10 hours ago
    expect(pipe.transform(time)).toBe('10 hours ago');
  });

  it('should return correct rounded years (e.g., 2 years ago)', () => {
    const time = new Date(NOW - 2 * 365 * 24 * 3600 * 1000 - 1000);
    expect(pipe.transform(time)).toBe('2 years ago');
  });

  // --- Test Suite for timer logic ---

  it('should set up a timer and mark for check after appropriate delay (e.g., 1 minute)', () => {
    const time = new Date(NOW - 5 * 60 * 1000); // 5 minutes old
    pipe.transform(time);

    // After 5 minutes, the update interval is set to 60000ms.

    // 1. Initial should not be marked yet
    expect(mockCdRef.markForCheck).not.toHaveBeenCalled();

    // 2. Simulate waiting for the timer
    clock.advanceTimersByTime(60001);

    // 3. After the timer, change detection should be triggered
    expect(mockCdRef.markForCheck).toHaveBeenCalled();

    // 4. Check if the timer was started outside the Angular Zone
    expect(mockNgZone.runOutsideAngular).toHaveBeenCalled();
  });

  it('should restart the timer and update interval if the input value changes', () => {
    // 1. First call: 'now', timer at 10s
    const time1 = new Date(NOW - 5 * 1000);
    expect(pipe.transform(time1)).toBe('now');

    // 2. Fast forward timer by 5s (timer has not expired yet)
    clock.advanceTimersByTime(5000);

    // 3. Second call with new, old timestamp: '1 minute ago', timer at 60s
    const time2 = new Date(NOW - 70 * 1000);
    expect(pipe.transform(time2)).toBe('1 minute ago');

    // The old timer (10s) should be cleared and a new one (60s) started.
    // We fast forward 5s (total elapsed time since time1: 10s)
    clock.advanceTimersByTime(5000);

    // CD should NOT be triggered yet, as the new 60s timer is still running
    expect(mockCdRef.markForCheck).not.toHaveBeenCalled();

    // Fast forward another 55s (total 60s, new timer has expired)
    clock.advanceTimersByTime(55001);

    // Now CD should be triggered
    expect(mockCdRef.markForCheck).toHaveBeenCalled();
  });
});
