import { vi } from 'vitest';

// Default mock for src/app/_tauri/pty.ts
// Provides a minimal Pty class with mocked methods
export class Pty {
  resize = vi.fn((cols: number, rows: number) => {});
  onData = vi.fn((listener: (e: string) => unknown) => {
    // return disposable
    return { dispose: vi.fn() };
  });
  write = vi.fn((data: string) => {});
  onExit = vi.fn((listener: (e: { exitCode: number; signal?: number }) => unknown) => {
    return { dispose: vi.fn() };
  });
}

export interface IDisposable { dispose(): void; }
export interface IEvent<T> { (listener: (e: T) => unknown): IDisposable; }
