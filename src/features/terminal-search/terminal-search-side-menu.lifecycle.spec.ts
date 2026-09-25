import type { SideMenuFeatureHandleContract } from "@cogno/shared/contributions";
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
  let sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>;
  let registerKeybindListenerMock: Mock<
    SideMenuFeatureHandleContract<string>["registerKeybindListener"]
  >;
  let closeMock: Mock<SideMenuFeatureHandleContract<string>["close"]>;
  let unregisterKeybindListenerMock: Mock<
    SideMenuFeatureHandleContract<string>["unregisterKeybindListener"]
  >;

  beforeEach(() => {
    registerKeybindListenerMock = vi.fn();
    closeMock = vi.fn();
    unregisterKeybindListenerMock = vi.fn();

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
      unregisterKeybindListener: unregisterKeybindListenerMock,
      updateIcon: vi.fn(),
      updateBadgeColor: vi.fn(),
    };
  });

  it("opens, closes and unregisters the side menu state", () => {
    const lifecycle = new TerminalSearchSideMenuLifecycle(
      terminalSearchService as TerminalSearchService,
    ).create(sideMenuFeatureHandle);

    lifecycle.onOpen?.();
    lifecycle.onModeChange?.("off");
    lifecycle.onClose?.();
    lifecycle.onBlur?.();

    expect(terminalSearchService.handleSideMenuOpen).toHaveBeenCalledTimes(1);
    expect(terminalSearchService.handleSideMenuClose).toHaveBeenCalledTimes(2);
    expect(unregisterKeybindListenerMock).toHaveBeenCalledTimes(1);
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

  it("closes on Escape and repeats the search when nothing is selected", () => {
    const lifecycle = new TerminalSearchSideMenuLifecycle(
      terminalSearchService as TerminalSearchService,
    );
    lifecycle.create(sideMenuFeatureHandle).onFocus?.();

    const keybindHandler = registerKeybindListenerMock.mock.calls[0][1] as (
      event: KeyboardEvent,
    ) => void;

    keybindHandler({ key: "Escape" } as KeyboardEvent);
    keybindHandler({ key: "Enter" } as KeyboardEvent);

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(terminalSearchService.repeatSearch).toHaveBeenCalledTimes(1);
  });
});
