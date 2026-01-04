import { vi } from 'vitest';

export const CliActionListener = {
  register: vi.fn().mockResolvedValue(() => {}),
};
