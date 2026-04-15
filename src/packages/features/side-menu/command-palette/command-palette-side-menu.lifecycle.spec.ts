import type { SideMenuFeatureHandleContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandEntry, CommandPaletteService } from "./command-palette.service";
import { CommandPaletteSideMenuLifecycle } from "./command-palette-side-menu.lifecycle";

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

  beforeEach(() => {
    registerKeybindListenerMock = vi.fn();
    closeMock = vi.fn();

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
      unregisterKeybindListener: vi.fn(),
      updateIcon: vi.fn(),
    };
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
});
