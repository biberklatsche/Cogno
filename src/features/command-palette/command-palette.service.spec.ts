import type { ActionEntryContract } from "@cogno/shared/domain";
import type { ActionCatalogContract, ActionDispatcherContract } from "@cogno/shared/ports";
import type { DirectionalNavigationItem } from "@cogno/shared/ui/common/navigation/directional-navigation.engine";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { CommandPaletteService } from "./command-palette.service";

describe("CommandPaletteService", () => {
  let service: CommandPaletteService;
  let dispatchActionMock: Mock<ActionDispatcherContract["dispatchAction"]>;
  let actionEntriesSubject: BehaviorSubject<ReadonlyArray<ActionEntryContract>>;

  beforeEach(() => {
    dispatchActionMock = vi.fn();
    actionEntriesSubject = new BehaviorSubject<ReadonlyArray<ActionEntryContract>>([
      {
        actionDefinition: { actionName: "open_command_palette" },
        keybinding: "ctrl+p",
      },
      {
        actionDefinition: { actionName: "copy" },
        keybinding: "ctrl+f",
      },
      {
        actionDefinition: { actionName: "split_right" },
        keybinding: "",
      },
    ]);

    const actionCatalog: ActionCatalogContract = {
      actionEntries$: actionEntriesSubject.asObservable(),
    };
    const actionDispatcher: Pick<ActionDispatcherContract, "dispatchAction"> = {
      dispatchAction: dispatchActionMock,
    };

    service = new CommandPaletteService(
      actionCatalog as any,
      actionDispatcher as any,
      getDestroyRef(),
    );
    service.handleSideMenuOpen();
  });

  it("initializes command list from host port entries", () => {
    const commandList = service.filteredCommandList();
    expect(commandList.length).toBe(3);
    expect(commandList.some((commandEntry) => commandEntry.label === "copy")).toBe(true);
    expect(commandList.some((commandEntry) => commandEntry.label === "open command palette")).toBe(
      true,
    );
    expect(commandList.some((commandEntry) => commandEntry.isSelected)).toBe(true);
  });

  it("filters command list case-insensitively", () => {
    service.filterCommands("COPY");
    const filteredCommandList = service.filteredCommandList();
    expect(filteredCommandList.length).toBe(1);
    expect(filteredCommandList[0].label).toBe("copy");
  });

  it("navigates through filtered entries", () => {
    service.registerNavigationItemsProvider(() => [
      createNavigationItem("copy", 0, 40, 280, 32),
      createNavigationItem("open_command_palette", 0, 74, 280, 32),
      createNavigationItem("split_right", 0, 108, 280, 32),
    ]);

    const initialCommandList = service.filteredCommandList();
    expect(initialCommandList[0].isSelected).toBe(true);

    service.handleNavigationKey("ArrowDown");
    expect(service.filteredCommandList()[1].isSelected).toBe(true);

    service.handleNavigationKey("ArrowUp");
    expect(service.filteredCommandList()[0].isSelected).toBe(true);
  });

  it("publishes selected action", () => {
    service.fireSelectedAction();

    expect(dispatchActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ actionName: "copy" }),
    );
  });

  it("updates command list when host port emits new entries", () => {
    actionEntriesSubject.next([
      {
        actionDefinition: { actionName: "new_tab" },
        keybinding: "ctrl+alt+t",
      },
    ]);

    const commandList = service.filteredCommandList();
    expect(commandList.length).toBe(1);
    expect(commandList[0].label).toBe("new tab");
    expect(commandList[0].keybinding).toBe("ctrl+alt+t");
  });

  it("keeps command entries and resets the filtered state on close", () => {
    service.filterCommands("copy");
    expect(service.filteredCommandList().length).toBe(1);

    service.handleSideMenuClose();
    expect(service.filteredCommandList().length).toBe(3);
    expect(service.filteredCommandList()[0].isSelected).toBe(true);
  });

  it("shows commands again when reopened after filtering", () => {
    service.filterCommands("copy");
    service.handleSideMenuClose();
    service.handleSideMenuOpen();

    expect(service.filteredCommandList().length).toBe(3);
  });
});

function createNavigationItem(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
): DirectionalNavigationItem<string> {
  return {
    id,
    rect: {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    },
  };
}
