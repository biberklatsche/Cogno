import type { ActionEntryContract } from "@cogno/shared/domain";
import type { ActionCatalog, ActionDispatcher } from "@cogno/shared/ports";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { CommandPaletteService } from "./command-palette.service";
import { CommandPaletteSideMenuLifecycle } from "./command-palette-side-menu.lifecycle";

vi.mock("@cogno/shared/ui/common/autofocus/focus-side-menu-autofocus-element", () => ({
  focusSideMenuAutofocusElement: vi.fn(),
}));

/**
 * Pins what the palette does as the panel and its side-menu lifecycle use it:
 * keys go in through the registered key listener, the list and the selection
 * are read the way the template reads them.
 */
describe("command palette behaviour", () => {
  let service: CommandPaletteService;
  let actionEntriesSubject: BehaviorSubject<ReadonlyArray<ActionEntryContract>>;
  let dispatchActionMock: Mock<(actionDefinition: { actionName: string }) => void>;
  let closeMock: Mock<() => void>;
  let press: (key: string) => void;

  const labels = () => service.filteredCommandList().map((commandEntry) => commandEntry.label);
  const selectedId = () => service.selectedEntry()?.id;

  beforeEach(() => {
    dispatchActionMock = vi.fn();
    actionEntriesSubject = new BehaviorSubject<ReadonlyArray<ActionEntryContract>>([
      { actionDefinition: { actionName: "split_right" }, keybinding: "" },
      { actionDefinition: { actionName: "open_command_palette" }, keybinding: "ctrl+p" },
      { actionDefinition: { actionName: "copy" }, keybinding: "ctrl+c" },
      { actionDefinition: { actionName: "Paste" }, keybinding: "ctrl+v" },
    ]);

    service = new CommandPaletteService(
      { actionEntries$: actionEntriesSubject.asObservable() } as unknown as ActionCatalog,
      { dispatchAction: dispatchActionMock } as unknown as ActionDispatcher,
      getDestroyRef(),
    );

    const lifecycle = new CommandPaletteSideMenuLifecycle(service);
    const registerKeybindListenerMock = vi.fn();
    // Closing the side menu runs the lifecycle's onClose, like the app does.
    closeMock = vi.fn(() => sideMenuLifecycle.onClose?.());
    const sideMenuLifecycle = lifecycle.create({
      close: closeMock,
      registerKeybindListener: registerKeybindListenerMock,
      unregisterKeybindListener: vi.fn(),
      updateIcon: vi.fn(),
    });
    sideMenuLifecycle.onOpen?.();
    sideMenuLifecycle.onFocus?.();
    press = (key) => registerKeybindListenerMock.mock.calls[0][1]({ key } as KeyboardEvent);
  });

  describe("entry list", () => {
    it("lists the catalog's actions sorted by label, with underscores shown as spaces", () => {
      expect(service.filteredCommandList()).toEqual([
        expect.objectContaining({
          id: "copy",
          label: "copy",
          keybinding: "ctrl+c",
          actionDefinition: { actionName: "copy" },
        }),
        expect.objectContaining({
          id: "open_command_palette",
          label: "open command palette",
          keybinding: "ctrl+p",
        }),
        expect.objectContaining({ id: "Paste", label: "Paste", keybinding: "ctrl+v" }),
        expect.objectContaining({ id: "split_right", label: "split right", keybinding: "" }),
      ]);
    });

    it("follows the catalog when it emits again and selects the first entry", () => {
      press("ArrowDown");

      actionEntriesSubject.next([
        { actionDefinition: { actionName: "new_tab" }, keybinding: "ctrl+t" },
        { actionDefinition: { actionName: "close_tab" }, keybinding: "ctrl+w" },
      ]);

      expect(labels()).toEqual(["close tab", "new tab"]);
      expect(selectedId()).toBe("close_tab");
    });

    it("keeps the typed query when the catalog emits again", () => {
      service.filterCommands("tab");
      expect(labels()).toEqual([]);

      actionEntriesSubject.next([
        { actionDefinition: { actionName: "new_tab" }, keybinding: "ctrl+t" },
        { actionDefinition: { actionName: "copy" }, keybinding: "ctrl+c" },
      ]);

      expect(labels()).toEqual(["new tab"]);
      expect(selectedId()).toBe("new_tab");
    });
  });

  describe("query", () => {
    it("matches a substring of the label, ignoring case", () => {
      service.filterCommands("PAl");
      expect(labels()).toEqual(["open command palette"]);

      service.filterCommands("p");
      expect(labels()).toEqual(["copy", "open command palette", "Paste", "split right"]);

      service.filterCommands("pa");
      expect(labels()).toEqual(["open command palette", "Paste"]);
    });

    it("matches against the label with spaces, not the action name", () => {
      service.filterCommands("command pal");
      expect(labels()).toEqual(["open command palette"]);

      service.filterCommands("command_pal");
      expect(labels()).toEqual([]);
    });

    it("is neither fuzzy nor trimmed, and does not look at the keybinding", () => {
      service.filterCommands("cpy");
      expect(labels()).toEqual([]);

      service.filterCommands("copy ");
      expect(labels()).toEqual([]);

      service.filterCommands("ctrl");
      expect(labels()).toEqual([]);
    });

    it("shows everything again for an empty query", () => {
      service.filterCommands("copy");
      service.filterCommands("");

      expect(labels()).toHaveLength(4);
    });
  });

  describe("selection", () => {
    it("selects the first entry after opening", () => {
      expect(selectedId()).toBe("copy");
    });

    it("selects the first match after every query change", () => {
      press("ArrowDown");
      press("ArrowDown");
      expect(selectedId()).toBe("Paste");

      service.filterCommands("pa");
      expect(selectedId()).toBe("open_command_palette");

      press("ArrowDown");
      expect(selectedId()).toBe("Paste");

      // Growing the list again does not keep "Paste" either.
      service.filterCommands("p");
      expect(selectedId()).toBe("copy");
    });

    it("selects the first entry again when the side menu reports open", () => {
      press("ArrowDown");

      service.handleSideMenuOpen();

      expect(selectedId()).toBe("copy");
    });

    it("moves down and up one row", () => {
      press("ArrowDown");
      expect(selectedId()).toBe("open_command_palette");

      press("ArrowDown");
      expect(selectedId()).toBe("Paste");

      press("ArrowUp");
      expect(selectedId()).toBe("open_command_palette");
    });

    it("wraps around at both ends", () => {
      press("ArrowUp");
      expect(selectedId()).toBe("split_right");

      press("ArrowDown");
      expect(selectedId()).toBe("copy");
    });

    it("moves within the filtered list only", () => {
      service.filterCommands("pa");

      press("ArrowDown");
      expect(selectedId()).toBe("Paste");

      press("ArrowDown");
      expect(selectedId()).toBe("open_command_palette");
    });

    it("stays on a single match", () => {
      service.filterCommands("copy");

      press("ArrowDown");
      expect(selectedId()).toBe("copy");

      press("ArrowUp");
      expect(selectedId()).toBe("copy");
    });

    it("has no selection and ignores the arrow keys when nothing matches", () => {
      service.filterCommands("no such command");

      press("ArrowDown");
      press("ArrowUp");

      expect(labels()).toEqual([]);
      expect(selectedId()).toBeUndefined();
    });
  });

  describe("Enter, click and Escape", () => {
    it("closes on Enter and then dispatches the entry that was selected", async () => {
      press("ArrowDown");

      press("Enter");

      expect(closeMock).toHaveBeenCalledTimes(1);
      expect(dispatchActionMock).not.toHaveBeenCalled();

      await Promise.resolve();

      expect(dispatchActionMock).toHaveBeenCalledTimes(1);
      expect(dispatchActionMock).toHaveBeenCalledWith({ actionName: "open_command_palette" });
    });

    // Odd, but what happens today: nothing is captured on Enter, closing resets the
    // palette, and the deferred dispatch then falls back to the new selection.
    it("closes on Enter when nothing matches and dispatches the first entry of the reset list", async () => {
      service.filterCommands("no such command");

      press("Enter");
      await Promise.resolve();

      expect(closeMock).toHaveBeenCalledTimes(1);
      expect(dispatchActionMock).toHaveBeenCalledTimes(1);
      expect(dispatchActionMock).toHaveBeenCalledWith({ actionName: "copy" });
    });

    it("dispatches a clicked entry, whatever is selected, and stays open", () => {
      const clickedEntry = service.filteredCommandList()[3];

      service.fireSelectedAction(clickedEntry);

      expect(dispatchActionMock).toHaveBeenCalledWith({ actionName: "split_right" });
      expect(closeMock).not.toHaveBeenCalled();
    });

    it("closes on Escape without dispatching", async () => {
      press("Escape");
      await Promise.resolve();

      expect(closeMock).toHaveBeenCalledTimes(1);
      expect(dispatchActionMock).not.toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("drops the query and the selection but keeps the entries", () => {
      service.filterCommands("pa");
      press("ArrowDown");

      service.handleSideMenuClose();

      expect(labels()).toHaveLength(4);
      expect(selectedId()).toBe("copy");

      service.handleSideMenuOpen();

      expect(labels()).toHaveLength(4);
      expect(selectedId()).toBe("copy");
    });
  });
});
