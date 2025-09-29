import { vi } from 'vitest';

// Default mock for src/app/_tauri/path.ts
export const Path = {
  join: vi.fn(async (...paths: string[]) => paths.join('/')),
  homeDir: vi.fn(async () => 'C:/Users/test'),
};
