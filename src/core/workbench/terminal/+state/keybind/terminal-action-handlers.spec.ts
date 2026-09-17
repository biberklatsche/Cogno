import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import type { SessionHost } from "@cogno/core/session/host/session-host";
import type { SessionFact } from "@cogno/core/session/session-facts";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { TabAddedEvent } from "@cogno/core/workbench/bus/tab-list/events";
import type { Grid } from "@cogno/core/workbench/grid-list/+model/model";
import type { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TerminalInputDispatcher } from "@cogno/core/workbench/terminal/+state/terminal-input.dispatcher";
import type { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { IdCreator } from "@cogno/shared/support";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  getAppBus,
  getDestroyRef,
  getGridListService,
  getSessionHostFactory,
  getTerminalSessionRegistry,
} from "../../../../../__test__/test-factory";
import { TerminalActionHandlers } from "./terminal-action-handlers";

const performable = { broadcast: false, unconsumed: false, performable: true, always: true };

function hostStub() {
  return {
    facts$: new Subject<SessionFact>(),
    hasSelection: false,
    focus: vi.fn(),
    blur: vi.fn(),
    setVisible: vi.fn(),
    setPaneMaximized: vi.fn(),
    clearBuffer: vi.fn(),
    paste: vi.fn(async () => undefined),
    copy: vi.fn(async () => undefined),
    cut: vi.fn(),
    runEditorAction: vi.fn(),
  };
}

/**
 * Terminal actions end to end: fire `ActionFired` the way a keybinding, the
 * command palette, the CLI or HTTP does, and look at the effect only - not at
 * how the handler reaches the grid or the session.
 */
describe("terminal actions, from ActionFired to their effect", () => {
  let bus: AppBus;
  let grid: GridListService;
  let registry: TerminalSessionRegistry;
  let hosts: Record<string, ReturnType<typeof hostStub>>;

  function addSession(terminalId: string): void {
    hosts[terminalId] = hostStub();
    registry.register(terminalId, {} as ShellProfile, hosts[terminalId] as unknown as SessionHost);
  }

  function focus(terminalId: string): void {
    hosts[terminalId].facts$.next({ type: "focusChanged", focused: true });
  }

  function fire(actionName: string, trigger?: typeof performable, terminalId?: string) {
    return bus.publish(ActionFired.create(actionName, trigger, undefined, terminalId));
  }

  function currentGrid(): Grid {
    let grids: Grid[] = [];
    grid.grids$.subscribe((value) => (grids = value));
    return grids[0];
  }

  /** Split `term-1` to the right into `term-2`, keeping `term-1` focused. */
  function splitIntoTwoPanes(): void {
    vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
    addSession("term-2");
    fire("split_right");
    focus("term-1");
  }

  beforeEach(() => {
    hosts = {};
    bus = getAppBus();
    registry = getTerminalSessionRegistry();
    grid = getGridListService();
    new TerminalActionHandlers(new ActionHandlers(bus, getDestroyRef()), grid, registry);
    new TerminalInputDispatcher(bus, registry, getDestroyRef());

    vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-1");
    addSession("term-1");
    bus.publish({ type: "TabAdded", payload: { tabId: "tab-1", isActive: true } } as TabAddedEvent);
    focus("term-1");
  });

  afterEach(() => {
    clear();
    vi.restoreAllMocks();
  });

  describe("splitting", () => {
    it.each([
      ["split_right", "vertical", "right"],
      ["split_left", "vertical", "left"],
      ["split_down", "horizontal", "right"],
      ["split_up", "horizontal", "left"],
    ] as const)("%s splits the focused pane %s, the new pane on the %s", (action, direction, side) => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");

      const result = fire(action);

      const root = currentGrid().tree.root;
      expect(result.performed).toBe(true);
      expect(root.isLeaf).toBe(false);
      expect(root.data?.splitDirection).toBe(direction);
      expect(root[side]?.data?.terminalId).toBe("term-2");
      expect(root[side === "right" ? "left" : "right"]?.data?.terminalId).toBe("term-1");
    });

    it("does not perform without a focused terminal, so the key falls through", () => {
      bus.publish({ type: "TabRemoved", payload: "tab-1" });

      expect(fire("split_right").performed).toBe(false);
      expect(fire("clear_line").performed).toBe(false);
      expect(hosts["term-1"].runEditorAction).not.toHaveBeenCalled();
    });
  });

  describe("panes", () => {
    it("select_next_pane and select_previous_pane move the focus", () => {
      splitIntoTwoPanes();

      fire("select_next_pane");
      expect(hosts["term-2"].focus).toHaveBeenCalled();

      focus("term-2");
      hosts["term-1"].focus.mockClear();
      fire("select_previous_pane");
      expect(hosts["term-1"].focus).toHaveBeenCalled();
    });

    it("maximize_pane toggles, and minimize_pane restores a maximized pane", () => {
      let maximized: string | undefined;
      grid.maximizedTerminalId$.subscribe((value) => (maximized = value));

      fire("maximize_pane");
      expect(maximized).toBe("term-1");

      fire("maximize_pane");
      expect(maximized).toBeUndefined();

      fire("maximize_pane");
      fire("minimize_pane");
      expect(maximized).toBeUndefined();
    });

    it("close_terminal removes the focused pane", () => {
      splitIntoTwoPanes();

      const result = fire("close_terminal");

      expect(result.performed).toBe(true);
      expect(getSessionHostFactory().destroy).toHaveBeenCalledWith("term-1");
      expect(currentGrid().tree.root.data?.terminalId).toBe("term-2");
    });
  });

  describe("the focused session", () => {
    it("paste and clear_buffer reach it", () => {
      fire("paste");
      fire("clear_buffer");

      expect(hosts["term-1"].paste).toHaveBeenCalledTimes(1);
      expect(hosts["term-1"].clearBuffer).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["clear_line", "clearLine"],
      ["clear_line_to_end", "clearLineToEnd"],
      ["clear_line_to_start", "clearLineToStart"],
      ["delete_previous_word", "deletePreviousWord"],
      ["delete_next_word", "deleteNextWord"],
      ["go_to_next_word", "goToNextWord"],
      ["go_to_previous_word", "goToPreviousWord"],
      ["go_to_start_of_line", "goToStartOfLine"],
      ["go_to_end_of_line", "goToEndOfLine"],
      ["select_text_right", "selectTextRight"],
      ["select_text_left", "selectTextLeft"],
      ["select_word_right", "selectWordRight"],
      ["select_word_left", "selectWordLeft"],
      ["select_text_to_end_of_line", "selectTextToEndOfLine"],
      ["select_text_to_start_of_line", "selectTextToStartOfLine"],
      ["select_all", "selectAll"],
    ])("%s runs the line editor's %s", (action, editorAction) => {
      const result = fire(action);

      expect(result.performed).toBe(true);
      expect(hosts["term-1"].runEditorAction).toHaveBeenCalledExactlyOnceWith(editorAction);
    });

    it("only the focused session is addressed", () => {
      splitIntoTwoPanes();

      fire("clear_line");

      expect(hosts["term-1"].runEditorAction).toHaveBeenCalledTimes(1);
      expect(hosts["term-2"].runEditorAction).not.toHaveBeenCalled();
    });
  });

  describe("an action that names its terminal (context menu, HTTP)", () => {
    it("runs on that session, not on the focused one", () => {
      splitIntoTwoPanes();

      const result = fire("clear_line", undefined, "term-2");

      expect(result.performed).toBe(true);
      expect(hosts["term-2"].runEditorAction).toHaveBeenCalledExactlyOnceWith("clearLine");
      expect(hosts["term-1"].runEditorAction).not.toHaveBeenCalled();
    });

    it("splits and closes the named pane", () => {
      splitIntoTwoPanes();
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-3");

      fire("split_down", undefined, "term-2");
      expect(currentGrid().tree.root.right?.left?.data?.terminalId).toBe("term-2");
      expect(currentGrid().tree.root.right?.right?.data?.terminalId).toBe("term-3");

      fire("close_terminal", undefined, "term-2");
      expect(getSessionHostFactory().destroy).toHaveBeenCalledWith("term-2");
    });

    it("checks the named session's selection for a performable copy", () => {
      splitIntoTwoPanes();
      hosts["term-2"].hasSelection = true;

      expect(fire("copy", performable, "term-2").performed).toBe(true);
      expect(hosts["term-2"].copy).toHaveBeenCalledTimes(1);
      expect(hosts["term-1"].copy).not.toHaveBeenCalled();
    });

    it("does not perform for a terminal that does not exist", () => {
      expect(fire("clear_line", undefined, "no-such-terminal").performed).toBe(false);
      expect(fire("split_right", undefined, "no-such-terminal").performed).toBe(false);
      expect(currentGrid().tree.root.isLeaf).toBe(true);
    });

    it("does not change the layout for a pane of a tab that is not showing", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-9");
      addSession("term-9");
      bus.publish({
        type: "TabAdded",
        payload: { tabId: "tab-2", isActive: true },
      } as TabAddedEvent);

      expect(fire("split_right", undefined, "term-1").performed).toBe(false);
      expect(fire("maximize_pane", undefined, "term-1").performed).toBe(false);
      // A session action still reaches it: the session is alive, just not showing.
      expect(fire("clear_buffer", undefined, "term-1").performed).toBe(true);
      expect(hosts["term-1"].clearBuffer).toHaveBeenCalledTimes(1);
    });
  });

  describe("copy and cut", () => {
    it("act on the selection of a performable trigger", () => {
      hosts["term-1"].hasSelection = true;

      expect(fire("copy", performable).performed).toBe(true);
      expect(fire("cut", performable).performed).toBe(true);

      expect(hosts["term-1"].copy).toHaveBeenCalledTimes(1);
      expect(hosts["term-1"].cut).toHaveBeenCalledTimes(1);
    });

    it("fall through when a performable trigger has no selection", () => {
      expect(fire("copy", performable).performed).toBe(false);
      expect(fire("cut", performable).performed).toBe(false);

      expect(hosts["term-1"].copy).not.toHaveBeenCalled();
      expect(hosts["term-1"].cut).not.toHaveBeenCalled();
    });

    it("run without a selection when the trigger is not performable (palette, CLI, HTTP)", () => {
      expect(fire("copy").performed).toBe(true);

      expect(hosts["term-1"].copy).toHaveBeenCalledTimes(1);
    });
  });
});
