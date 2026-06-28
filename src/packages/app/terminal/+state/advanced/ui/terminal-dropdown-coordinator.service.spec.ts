import { describe, expect, it, vi } from "vitest";
import { TerminalDropdownCoordinatorService } from "./terminal-dropdown-coordinator.service";

describe("TerminalDropdownCoordinatorService", () => {
  it("hides the previous owner when a different owner claims", () => {
    const coordinator = new TerminalDropdownCoordinatorService();
    const first = { hide: vi.fn(), dispatchKeydown: vi.fn() };
    const second = { hide: vi.fn(), dispatchKeydown: vi.fn() };

    coordinator.claim(first);
    coordinator.claim(second);

    expect(first.hide).toHaveBeenCalledTimes(1);
    expect(second.hide).not.toHaveBeenCalled();
  });

  it("does not hide when the same owner claims again", () => {
    const coordinator = new TerminalDropdownCoordinatorService();
    const owner = { hide: vi.fn(), dispatchKeydown: vi.fn() };

    coordinator.claim(owner);
    coordinator.claim(owner);

    expect(owner.hide).not.toHaveBeenCalled();
  });

  it("release only clears the current owner if it matches", () => {
    const coordinator = new TerminalDropdownCoordinatorService();
    const first = { hide: vi.fn(), dispatchKeydown: vi.fn() };
    const second = { hide: vi.fn(), dispatchKeydown: vi.fn() };

    coordinator.claim(first);
    coordinator.release(second);
    coordinator.claim(second);

    expect(first.hide).toHaveBeenCalledTimes(1);
  });
});
