import { vi } from 'vitest';

export const Process = {
  exit: vi.fn().mockResolvedValue(undefined),
  relaunch: vi.fn().mockResolvedValue(undefined),
};
