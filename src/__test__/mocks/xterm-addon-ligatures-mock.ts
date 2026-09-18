import { vi } from "vitest";

class LigaturesAddonMock {
  dispose = vi.fn();
}

export const LigaturesAddon = vi.fn(LigaturesAddonMock);
