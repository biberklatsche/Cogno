import { vi } from 'vitest';

// Default mock for src/app/_tauri/os.ts
export type OsType = 'linux' | 'windows' | 'macos';

export const OS = {
  platform: vi.fn((): OsType => 'windows'),
};
