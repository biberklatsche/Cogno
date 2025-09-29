import { vi } from 'vitest';
import { Observable } from 'rxjs';

// Default mock for src/app/_tauri/fs.ts
// Mirrors the Fs object API with sensible defaults for tests
export const Fs = {
  readTextFile: vi.fn().mockResolvedValue(''),
  watchChanges$: vi.fn((path: string, _opts?: { recursive?: boolean }): Observable<void> => {
    // Emit nothing by default; tests can override via mockImplementation
    return new Observable<void>(() => {
      // no-op teardown
      return () => {};
    });
  }),
  exists: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `mock://${path}`),
};

// Provide a default for exists -> true, common for most tests
Fs.exists.mockResolvedValue(true);
