import { vi } from 'vitest';
import { Observable } from 'rxjs';

// Default mock for src/app/_tauri/window.ts
export const AppWindow = {
  isFocused: vi.fn(async () => true),
  isVisible: vi.fn(async () => true),
  isMaximized: vi.fn(async () => false),
  isMinimized: vi.fn(async () => false),
  close: vi.fn(async () => {}),
  minimize: vi.fn(async () => {}),
  unminimize: vi.fn(async () => {}),
  maximize: vi.fn(async () => {}),
  unmaximize: vi.fn(async () => {}),
  windowSize$: new Observable<{ width: number; height: number }>((subscriber) => {
    subscriber.next({ width: 800, height: 600 });
    // keep open; tests can unsubscribe; no teardown needed
    return () => {};
  }),
};

export type WindowSize = { width: number; height: number };
