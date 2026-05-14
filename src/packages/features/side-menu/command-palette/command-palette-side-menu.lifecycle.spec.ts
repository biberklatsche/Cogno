import type { SideMenuFeatureHandleContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandEntry, CommandPaletteService } from "./command-palette.service";
import { CommandPaletteSideMenuLifecycle } from "./command-palette-side-menu.lifecycle";

vi.mock("../focus-side-menu-autofocus-element", () => ({
  focusSideMenuAutofocusElement: vi.fn(),
}));

describe("CommandPaletteSideMenuLifecycle", () => {
  let commandPaletteService: Pick<
    CommandPaletteService,
    | "getSelectedEntry"
    | "fireSelectedAction"
    | "handleSideMenuOpen"
    | "handleSideMenuClose"
    | "handleNavigationKey"
  >;
  let sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>;
  let registerKeybindListenerMock: ReturnType<typeof vi.fn>;
  let closeMock: ReturnType<typeof vi.fn>;
  let unregisterKeybindListenerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registerKeybindListenerMock = vi.fn();
    closeMock = vi.fn();
    unregisterKeybindListenerMock = vi.fn();

    commandPaletteService = {
      getSelectedEntry: vi.fn(),
      fireSelectedAction: vi.fn(),
      handleSideMenuOpen: vi.fn(),
      handleSideMenuClose: vi.fn(),
      handleNavigationKey: vi.fn(),
    };

    sideMenuFeatureHandle = {
      close: closeMock,
      registerKeybindListener: registerKeybindListenerMock,
      unregisterKeybindListener: unregisterKeybindListenerMock,
      updateIcon: vi.fn(),
    };
  });

  it("opens, closes, unregisters and handles off mode", () => {
    const lifecycle = new CommandPaletteSideMenuLifecycle(
      commandPaletteService as CommandPaletteService,
    ).create(sideMenuFeatureHandle);

    lifecycle.onOpen?.();
    lifecycle.onModeChange?.("off");
    lifecycle.onClose?.();
    lifecycle.onBlur?.();

    expect(commandPaletteService.handleSideMenuOpen).toHaveBeenCalledTimes(1);
    expect(commandPaletteService.handleSideMenuClose).toHaveBeenCalledTimes(2);
    expect(unregisterKeybindListenerMock).toHaveBeenCalledTimes(1);
  });

  it("fires the selected entry captured before close", async () => {
    const selectedEntry: CommandEntry = {
      id: "split_right",
      isSelected: true,
      label: "split right",
      keybinding: "",
      actionDefinition: { actionName: "split_right" },
    };
    vi.mocked(commandPaletteService.getSelectedEntry).mockReturnValue(selectedEntry);

    const lifecycle = new CommandPaletteSideMenuLifecycle(
      commandPaletteService as CommandPaletteService,
    );
    lifecycle.create(sideMenuFeatureHandle).onFocus?.();

    const keybindHandler = registerKeybindListenerMock.mock.calls[0][1] as (
      event: KeyboardEvent,
    ) => void;
    keybindHandler({ key: "Enter" } as KeyboardEvent);

    await Promise.resolve();

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(commandPaletteService.fireSelectedAction).toHaveBeenCalledWith(selectedEntry);
  });

  it("closes on Escape and routes navigation keys", () => {
    const lifecycle = new CommandPaletteSideMenuLifecycle(
      commandPaletteService as CommandPaletteService,
    );
    lifecycle.create(sideMenuFeatureHandle).onFocus?.();

    const keybindHandler = registerKeybindListenerMock.mock.calls[0][1] as (
      event: KeyboardEvent,
    ) => void;

    keybindHandler({ key: "Escape" } as KeyboardEvent);
    keybindHandler({ key: "ArrowDown" } as KeyboardEvent);

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(commandPaletteService.handleNavigationKey).toHaveBeenCalledWith("ArrowDown");
  });
});
