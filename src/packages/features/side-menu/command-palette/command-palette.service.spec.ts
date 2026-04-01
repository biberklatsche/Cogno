import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BehaviorSubject } from "rxjs";
import {
  CommandPaletteCommandEntryContract,
  CommandPaletteHostPortContract,
} from "@cogno/core-api";
import { DirectionalNavigationItem } from "@cogno/features/side-menu/navigation/directional-navigation.engine";
import { CommandPaletteService } from "@cogno/features/side-menu/command-palette/command-palette.service";
import { getDestroyRef } from "../../__test__/destroy-ref";

describe("CommandPaletteService", () => {
  let service: CommandPaletteService;
  let publishActionMock: ReturnType<typeof vi.fn>;
  let commandEntriesSubject: BehaviorSubject<ReadonlyArray<CommandPaletteCommandEntryContract>>;

  beforeEach(() => {
    publishActionMock = vi.fn();
    commandEntriesSubject = new BehaviorSubject<ReadonlyArray<CommandPaletteCommandEntryContract>>([
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

    const commandPaletteHostPort: CommandPaletteHostPortContract = {
      commandEntries$: commandEntriesSubject.asObservable(),
      publishAction: publishActionMock,
    };

    service = new CommandPaletteService(commandPaletteHostPort, getDestroyRef());
    service.handleSideMenuOpen();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes command list from host port entries", () => {
    const commandList = service.filteredCommandList();
    expect(commandList.length).toBe(3);
    expect(commandList.some((commandEntry) => commandEntry.label === "copy")).toBe(true);
    expect(commandList.some((commandEntry) => commandEntry.label === "open command palette")).toBe(true);
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
      createNavigationItem("open command palette", 0, 74, 280, 32),
      createNavigationItem("split right", 0, 108, 280, 32),
    ]);

    const initialCommandList = service.filteredCommandList();
    expect(initialCommandList[0].isSelected).toBe(true);

    service.handleNavigationKey("ArrowDown");
    expect(service.filteredCommandList()[1].isSelected).toBe(true);

    service.handleNavigationKey("ArrowUp");
    expect(service.filteredCommandList()[0].isSelected).toBe(true);
  });

  it("publishes selected action", () => {
    vi.useFakeTimers();
    service.fireSelectedAction();
    vi.runAllTimers();

    expect(publishActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ actionName: "copy" }),
    );
  });

  it("updates command list when host port emits new entries", () => {
    commandEntriesSubject.next([
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



