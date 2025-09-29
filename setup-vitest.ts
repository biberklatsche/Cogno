// Vitest setup file
import { afterEach, vi } from 'vitest';
import '@angular/compiler';

// Globally mock our Tauri wrapper modules to default implementations from __mocks__
vi.mock('/src/app/_tauri/fs.ts', () => import('./src/__mocks__/_tauri-fs'));
vi.mock('/src/app/_tauri/db.ts', () => import('./src/__mocks__/_tauri-db'));
vi.mock('/src/app/_tauri/pty.ts', () => import('./src/__mocks__/_tauri-pty'));
vi.mock('/src/app/_tauri/window.ts', () => import('./src/__mocks__/_tauri-window'));
vi.mock('/src/app/_tauri/os.ts', () => import('./src/__mocks__/_tauri-os'));
vi.mock('/src/app/_tauri/path.ts', () => import('./src/__mocks__/_tauri-path'));
vi.mock('/src/app/_tauri/logger.ts', () => import('./src/__mocks__/_tauri-logger'));

// Reset all mocks between tests to keep isolation similar to Jest
afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
