import { vi } from 'vitest';

export const KeyboardLayout = {
  load: vi.fn().mockResolvedValue({
    id: '00000407',
    name: 'German',
  }),
};
