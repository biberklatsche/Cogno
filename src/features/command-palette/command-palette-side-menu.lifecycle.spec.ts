import type { SideMenuFeatureHandleContract } from "@cogno/core/api/contributions";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { CommandEntry, CommandPaletteService } from "./command-palette.service";
import { CommandPaletteSideMenuLifecycle } from "./command-palette-side-menu.lifecycle";

vi.mock("@cogno/shared/ui/common/autofocus/focus-side-menu-autofocus-element", () => ({
  focusSideMenuAutofocusElement: vi.fn(),
}));

describe("CommandPaletteSideMenuLifecycle", () => {
  let commandPaletteService: Pick<
    CommandPaletteService,
    "selectedEntry" | "fireSelectedAction" | "handleSideMenuClose" | "move"
  >;
  let sideMenuFeatureHandle: SideMenuFeatureHandleContract;
  let registerKeybindListenerMock: Mock<SideMenuFeatureHandleContract["registerKeybindListener"]>;
  let closeMock: Mock<SideMenuFeatureHandleContract["close"]>;

  beforeEach(() => {
    registerKeybindListenerMock = vi.fn();
    closeMock = vi.fn();

    commandPaletteService = {
      selectedEntry: vi.fn() as unknown as CommandPaletteService["selectedEntry"],
      fireSelectedAction: vi.fn(),
      handleSideMenuClose: vi.fn(),
      move: vi.fn(),
    };

    sideMenuFeatureHandle = {
      close: closeMock,
      registerKeybindListener: registerKeybindListenerMock,
      updateBadgeColor: vi.fn(),
    };
  });

  it("resets the palette on close and on off mode", () => {
    const lifecycle = new CommandPaletteSideMenuLifecycle(
      commandPaletteService as CommandPaletteService,
    ).create(sideMenuFeatureHandle);

    lifecycle.onOpen?.();
    lifecycle.onModeChange?.("off");
    lifecycle.onClose?.();

    expect(commandPaletteService.handleSideMenuClose).toHaveBeenCalledTimes(2);
  });

  it("fires the selected entry captured before close", async () => {
    const selectedEntry: CommandEntry = {
      id: "split_right",
      label: "split right",
      keybinding: "",
      actionDefinition: { actionName: "split_right" },
    };
    vi.mocked(commandPaletteService.selectedEntry).mockReturnValue(selectedEntry);

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

  it("routes navigation keys and leaves Escape to the host", () => {
    const lifecycle = new CommandPaletteSideMenuLifecycle(
      commandPaletteService as CommandPaletteService,
    );
    lifecycle.create(sideMenuFeatureHandle).onFocus?.();

    const [keys, keybindHandler] = registerKeybindListenerMock.mock.calls[0];
    expect(keys).not.toContain("Escape");

    keybindHandler({ key: "ArrowDown" } as KeyboardEvent);
    keybindHandler({ key: "ArrowUp" } as KeyboardEvent);

    expect(closeMock).not.toHaveBeenCalled();
    expect(commandPaletteService.move).toHaveBeenNthCalledWith(1, 1);
    expect(commandPaletteService.move).toHaveBeenNthCalledWith(2, -1);
  });
});
