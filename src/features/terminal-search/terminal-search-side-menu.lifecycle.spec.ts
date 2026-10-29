import type { SideMenuFeatureHandleContract } from "@cogno/core/api/contributions";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { TerminalSearchService } from "./terminal-search.service";
import { TerminalSearchSideMenuLifecycle } from "./terminal-search-side-menu.lifecycle";

vi.mock("@cogno/shared/ui/common/autofocus/focus-side-menu-autofocus-element", () => ({
  focusSideMenuAutofocusElement: vi.fn(),
}));

describe("TerminalSearchSideMenuLifecycle", () => {
  let terminalSearchService: Pick<
    TerminalSearchService,
    | "handleSideMenuOpen"
    | "handleSideMenuClose"
    | "move"
    | "repeatSearch"
    | "revealSelectedSearchResult"
  >;
  let sideMenuFeatureHandle: SideMenuFeatureHandleContract;
  let registerKeybindListenerMock: Mock<SideMenuFeatureHandleContract["registerKeybindListener"]>;
  let closeMock: Mock<SideMenuFeatureHandleContract["close"]>;

  beforeEach(() => {
    registerKeybindListenerMock = vi.fn();
    closeMock = vi.fn();

    terminalSearchService = {
      handleSideMenuOpen: vi.fn(),
      handleSideMenuClose: vi.fn(),
      move: vi.fn(),
      repeatSearch: vi.fn(),
      revealSelectedSearchResult: vi.fn().mockReturnValue(false),
    };

    sideMenuFeatureHandle = {
      close: closeMock,
      registerKeybindListener: registerKeybindListenerMock,
      updateBadgeColor: vi.fn(),
    };
  });

  it("opens and closes the side menu state", () => {
    const lifecycle = new TerminalSearchSideMenuLifecycle(
      terminalSearchService as TerminalSearchService,
    ).create(sideMenuFeatureHandle);

    lifecycle.onOpen?.();
    lifecycle.onModeChange?.("off");
    lifecycle.onClose?.();

    expect(terminalSearchService.handleSideMenuOpen).toHaveBeenCalledTimes(1);
    expect(terminalSearchService.handleSideMenuClose).toHaveBeenCalledTimes(2);
  });

  it("reveals the selected search result on Enter when one is selected", () => {
    vi.mocked(terminalSearchService.revealSelectedSearchResult).mockReturnValue(true);

    const lifecycle = new TerminalSearchSideMenuLifecycle(
      terminalSearchService as TerminalSearchService,
    );
    lifecycle.create(sideMenuFeatureHandle).onFocus?.();

    const keybindHandler = registerKeybindListenerMock.mock.calls[0][1] as (
      event: KeyboardEvent,
    ) => void;
    keybindHandler({ key: "Enter" } as KeyboardEvent);

    expect(terminalSearchService.revealSelectedSearchResult).toHaveBeenCalledTimes(1);
    expect(terminalSearchService.repeatSearch).not.toHaveBeenCalled();
  });

  it("routes arrow keys to the selection", () => {
    const lifecycle = new TerminalSearchSideMenuLifecycle(
      terminalSearchService as TerminalSearchService,
    );
    lifecycle.create(sideMenuFeatureHandle).onFocus?.();

    const keybindHandler = registerKeybindListenerMock.mock.calls[0][1] as (
      event: KeyboardEvent,
    ) => void;
    keybindHandler({ key: "ArrowDown" } as KeyboardEvent);
    keybindHandler({ key: "ArrowUp" } as KeyboardEvent);

    expect(terminalSearchService.move).toHaveBeenNthCalledWith(1, 1);
    expect(terminalSearchService.move).toHaveBeenNthCalledWith(2, -1);
  });

  it("repeats the search on Enter when nothing is selected and leaves Escape to the host", () => {
    const lifecycle = new TerminalSearchSideMenuLifecycle(
      terminalSearchService as TerminalSearchService,
    );
    lifecycle.create(sideMenuFeatureHandle).onFocus?.();

    const [keys, keybindHandler] = registerKeybindListenerMock.mock.calls[0];
    expect(keys).not.toContain("Escape");

    keybindHandler({ key: "Enter" } as KeyboardEvent);

    expect(closeMock).not.toHaveBeenCalled();
    expect(terminalSearchService.repeatSearch).toHaveBeenCalledTimes(1);
  });
});
