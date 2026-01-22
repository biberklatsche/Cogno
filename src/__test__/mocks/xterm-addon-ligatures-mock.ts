import { vi } from 'vitest';

export const LigaturesAddon = vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
}));
