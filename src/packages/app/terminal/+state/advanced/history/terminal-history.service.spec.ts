import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionFired } from "../../../../action/action.models";
import { AppBus } from "../../../../app-bus/app-bus";
import type { TerminalState } from "../../state";
import { TerminalDropdownCoordinatorService } from "../ui/terminal-dropdown-coordinator.service";
import type { RecentCommandRow } from "./history.repository";
import { TerminalHistoryService } from "./terminal-history.service";
import type { TerminalHistoryPersistenceService } from "./terminal-history-persistence.service";

class FakeStateManager {
  private readonly subject = new BehaviorSubject<TerminalState>({
    hasUnreadNotification: false,
    progress: { state: "hidden", value: 0 },
    terminalId: "t1",
    shellContext: { shellType: "Bash", backendOs: "macos" } as any,
    cursorPosition: { viewport: { col: 1, row: 1 }, col: 1, row: 1, char: "" },
    mousePosition: { viewport: { col: 1, row: 1 }, col: 1, row: 1, char: "" },
    dimensions: {
      rows: 24,
      cols: 80,
      cellHeight: 18,
      cellWidth: 9,
      viewportWidth: 720,
      viewportHeight: 432,
    },
    isFocused: true,
    hasSelection: false,
    isCommandRunning: false,
    isInFullScreenMode: false,
    isPaneMaximized: false,
    scrolledLinesFromBottom: 0,
    commandStartTime: undefined,
    input: { text: "", cursorIndex: 0, maxCursorIndex: 0 },
    cwd: "/Users/larswolfram/projects",
  });

  get state$() {
    return this.subject.asObservable();
  }
  get isFocused() {
    return this.subject.value.isFocused;
  }
  get state() {
    return this.subject.value;
  }
  get terminalId() {
    return this.subject.value.terminalId;
  }

  emit(next: Partial<TerminalState>) {
    this.subject.next({ ...this.subject.value, ...next });
  }
}

function makeRows(commands: string[]): RecentCommandRow[] {
  return commands.map((command, index) => ({ command, executedAt: 1000 - index }));
}

describe("TerminalHistoryService", () => {
  let fakeState: FakeStateManager;
  let bus: AppBus;
  let coordinator: TerminalDropdownCoordinatorService;
  let persistence: {
    getRecentCommands: ReturnType<typeof vi.fn>;
    markCommandSelected: ReturnType<typeof vi.fn>;
  };
  let service: TerminalHistoryService;

  beforeEach(() => {
    fakeState = new FakeStateManager();
    bus = new AppBus();
    coordinator = new TerminalDropdownCoordinatorService();
    persistence = {
      getRecentCommands: vi.fn().mockResolvedValue(makeRows(["git status", "npm test"])),
      markCommandSelected: vi.fn(),
    };
    service = new TerminalHistoryService(
      fakeState as unknown as any,
      persistence as unknown as TerminalHistoryPersistenceService,
      bus,
      coordinator,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it("shows the panel with the most recent entry preselected when triggered", async () => {
    bus.publish(ActionFired.create("trigger_command_history"));

    const view = await new Promise((resolve) => {
      service.viewState$.subscribe((v) => v.visible && resolve(v));
    });

    expect(view).toMatchObject({
      visible: true,
      selectedIndex: 0,
      entries: makeRows(["git status", "npm test"]),
      scope: "global",
    });
    expect(persistence.getRecentCommands).toHaveBeenCalledWith({
      scope: "global",
      cwdRaw: "/Users/larswolfram/projects",
    });
  });

  it("does nothing when not focused", async () => {
    fakeState.emit({ isFocused: false });
    bus.publish(ActionFired.create("trigger_command_history"));
    await Promise.resolve();

    expect(persistence.getRecentCommands).not.toHaveBeenCalled();
  });

  it("publishes ApplyAutocompleteSuggestion and hides when an entry is selected", async () => {
    const publishSpy = vi.spyOn(bus, "publish");
    bus.publish(ActionFired.create("trigger_command_history"));
    await new Promise((resolve) => {
      service.viewState$.subscribe((v) => v.visible && resolve(v));
    });

    service.selectEntry(1);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ApplyAutocompleteSuggestion",
        payload: { terminalId: "t1", inputText: "npm test", cursorIndex: 8 },
      }),
    );
    expect(persistence.markCommandSelected).toHaveBeenCalledWith(
      "npm test",
      "/Users/larswolfram/projects",
    );

    const view = await new Promise((resolve) => {
      service.viewState$.subscribe(resolve);
    });
    expect((view as any).visible).toBe(false);
  });

  it("re-queries and cycles through scopes on cycle_tab while visible", async () => {
    bus.publish(ActionFired.create("trigger_command_history"));
    await new Promise((resolve) => {
      service.viewState$.subscribe((v) => v.visible && resolve(v));
    });
    expect(persistence.getRecentCommands).toHaveBeenCalledTimes(1);

    bus.publish(ActionFired.create("cycle_tab"));
    await vi.waitFor(() => expect(persistence.getRecentCommands).toHaveBeenCalledTimes(2));

    expect(persistence.getRecentCommands).toHaveBeenLastCalledWith({
      scope: "cwd",
      cwdRaw: "/Users/larswolfram/projects",
    });
  });

  it("ignores cycle_tab while hidden", async () => {
    bus.publish(ActionFired.create("cycle_tab"));
    await Promise.resolve();

    expect(persistence.getRecentCommands).not.toHaveBeenCalled();
  });

  it("falls back to the global scope when the preferred scope has no entries", async () => {
    window.localStorage.setItem("terminal.history.scope", "session");
    persistence.getRecentCommands.mockImplementation(async ({ scope }: { scope: string }) =>
      scope === "global" ? makeRows(["git status", "npm test"]) : [],
    );

    const localBus = new AppBus();
    const fallbackService = new TerminalHistoryService(
      fakeState as unknown as any,
      persistence as unknown as TerminalHistoryPersistenceService,
      localBus,
      coordinator,
    );
    localBus.publish(ActionFired.create("trigger_command_history"));

    const view = await new Promise((resolve) => {
      fallbackService.viewState$.subscribe((v) => v.visible && resolve(v));
    });

    expect(view).toMatchObject({ visible: true, scope: "global" });
    expect(persistence.getRecentCommands).toHaveBeenLastCalledWith({
      scope: "global",
      cwdRaw: "/Users/larswolfram/projects",
    });

    fallbackService.ngOnDestroy();
    window.localStorage.removeItem("terminal.history.scope");
  });

  it("tags entries with their origin relative to the current session/cwd", async () => {
    persistence.getRecentCommands.mockResolvedValue([
      { command: "git status", executedAt: 1000, isCurrentSession: 1, isCurrentCwd: 0 },
      { command: "npm test", executedAt: 999, isCurrentSession: 0, isCurrentCwd: 1 },
      { command: "ls", executedAt: 998, isCurrentSession: 0, isCurrentCwd: 0 },
    ]);

    bus.publish(ActionFired.create("trigger_command_history"));
    const view = (await new Promise((resolve) => {
      service.viewState$.subscribe((v) => v.visible && resolve(v));
    })) as { entries: { command: string; origin?: string }[] };

    expect(view.entries).toEqual([
      { command: "git status", executedAt: 1000, origin: "session" },
      { command: "npm test", executedAt: 999, origin: "cwd" },
      { command: "ls", executedAt: 998, origin: undefined },
    ]);
  });
});
