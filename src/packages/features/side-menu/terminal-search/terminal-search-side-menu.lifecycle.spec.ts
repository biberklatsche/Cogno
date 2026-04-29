import type { SideMenuFeatureHandleContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TerminalSearchService } from "./terminal-search.service";
import { TerminalSearchSideMenuLifecycle } from "./terminal-search-side-menu.lifecycle";

describe("TerminalSearchSideMenuLifecycle", () => {
  let terminalSearchService: Pick<
    TerminalSearchService,
    | "handleSideMenuOpen"
    | "handleSideMenuClose"
    | "handleNavigationKey"
    | "repeatSearch"
    | "revealSelectedSearchResult"
  >;
  let sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>;
  let registerKeybindListenerMock: ReturnType<typeof vi.fn>;
  let closeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registerKeybindListenerMock = vi.fn();
    closeMock = vi.fn();

    terminalSearchService = {
      handleSideMenuOpen: vi.fn(),
      handleSideMenuClose: vi.fn(),
      handleNavigationKey: vi.fn(),
      repeatSearch: vi.fn(),
      revealSelectedSearchResult: vi.fn().mockReturnValue(false),
    };

    sideMenuFeatureHandle = {
      close: closeMock,
      registerKeybindListener: registerKeybindListenerMock,
      unregisterKeybindListener: vi.fn(),
      updateIcon: vi.fn(),
    };
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

  it("routes arrow keys to navigation handling", () => {
    const lifecycle = new TerminalSearchSideMenuLifecycle(
      terminalSearchService as TerminalSearchService,
    );
    lifecycle.create(sideMenuFeatureHandle).onFocus?.();

    const keybindHandler = registerKeybindListenerMock.mock.calls[0][1] as (
      event: KeyboardEvent,
    ) => void;
    keybindHandler({ key: "ArrowDown" } as KeyboardEvent);
    keybindHandler({ key: "ArrowUp" } as KeyboardEvent);

    expect(terminalSearchService.handleNavigationKey).toHaveBeenNthCalledWith(1, "ArrowDown");
    expect(terminalSearchService.handleNavigationKey).toHaveBeenNthCalledWith(2, "ArrowUp");
  });
});
