import type { RecentCommandRow } from "@cogno/core/command-log/command-log.repository";
import type { SessionCommandLog as TerminalHistoryPersistenceService } from "@cogno/core/session/command-log/session-command-log";
import { TerminalDropdownCoordinatorService } from "@cogno/core/session/dropdown/terminal-dropdown-coordinator.service";
import type { SessionState } from "@cogno/core/session/host/session-host";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalHistoryService } from "./terminal-history.service";
import { TerminalHistoryScopeStore } from "./terminal-history-scope.store";

class FakeStateManager {
  readonly replaceInput = vi.fn();
  private readonly subject = new BehaviorSubject<SessionState>({
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

  emit(next: Partial<SessionState>) {
    this.subject.next({ ...this.subject.value, ...next });
  }
}

function makeRows(commands: string[]): RecentCommandRow[] {
  return commands.map((command, index) => ({ command, executedAt: 1000 - index }));
}

describe("TerminalHistoryService", () => {
  let fakeState: FakeStateManager;
  let coordinator: TerminalDropdownCoordinatorService;
  let persistence: {
    getRecentCommands: ReturnType<typeof vi.fn>;
    markCommandSelected: ReturnType<typeof vi.fn>;
  };
  let service: TerminalHistoryService;
  let scopeStore: TerminalHistoryScopeStore;

  beforeEach(() => {
    window.localStorage.removeItem("terminal.history.scope");
    fakeState = new FakeStateManager();
    coordinator = new TerminalDropdownCoordinatorService();
    persistence = {
      getRecentCommands: vi.fn().mockResolvedValue(makeRows(["git status", "npm test"])),
      markCommandSelected: vi.fn(),
    };
    scopeStore = new TerminalHistoryScopeStore();
    service = new TerminalHistoryService(
      fakeState as unknown as any,
      persistence as unknown as TerminalHistoryPersistenceService,
      coordinator,
      { config: {} } as any,
      scopeStore,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it("shows the panel with the most recent entry preselected when triggered", async () => {
    void service.triggerCommandHistory();

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
    void service.triggerCommandHistory();
    await Promise.resolve();

    expect(persistence.getRecentCommands).not.toHaveBeenCalled();
  });

  it("replaces the input and hides when an entry is selected", async () => {
    void service.triggerCommandHistory();
    await new Promise((resolve) => {
      service.viewState$.subscribe((v) => v.visible && resolve(v));
    });

    service.selectEntry(1);

    expect(fakeState.replaceInput).toHaveBeenCalledWith("npm test", 8, false);
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
    void service.triggerCommandHistory();
    await new Promise((resolve) => {
      service.viewState$.subscribe((v) => v.visible && resolve(v));
    });
    expect(persistence.getRecentCommands).toHaveBeenCalledTimes(1);

    service.cycleTab();
    await vi.waitFor(() => expect(persistence.getRecentCommands).toHaveBeenCalledTimes(2));

    expect(persistence.getRecentCommands).toHaveBeenLastCalledWith({
      scope: "cwd",
      cwdRaw: "/Users/larswolfram/projects",
    });
  });

  it("ignores cycle_tab while hidden", async () => {
    service.cycleTab();
    await Promise.resolve();

    expect(persistence.getRecentCommands).not.toHaveBeenCalled();
  });

  it("keeps the persisted scope even when it has no entries (empty state instead of fallback)", async () => {
    window.localStorage.setItem("terminal.history.scope", "session");
    persistence.getRecentCommands.mockImplementation(async ({ scope }: { scope: string }) =>
      scope === "global" ? makeRows(["git status", "npm test"]) : [],
    );

    // Fresh store constructed after the localStorage write so it loads the persisted "session".
    const stickyScopeStore = new TerminalHistoryScopeStore();
    const stickyScopeService = new TerminalHistoryService(
      fakeState as unknown as any,
      persistence as unknown as TerminalHistoryPersistenceService,
      coordinator,
      { config: {} } as any,
      stickyScopeStore,
    );
    void stickyScopeService.triggerCommandHistory();

    const view = await new Promise((resolve) => {
      stickyScopeService.viewState$.subscribe((v) => v.visible && resolve(v));
    });

    // The scope is sticky: the panel opens in the persisted scope and shows
    // its empty state; the user switches scopes explicitly via cycle_tab.
    expect(view).toMatchObject({ visible: true, scope: "session", entries: [] });
    expect(persistence.getRecentCommands).toHaveBeenLastCalledWith({
      scope: "session",
      cwdRaw: "/Users/larswolfram/projects",
    });

    stickyScopeService.ngOnDestroy();
    window.localStorage.removeItem("terminal.history.scope");
  });

  it("tags entries with their origin relative to the current session/cwd", async () => {
    persistence.getRecentCommands.mockResolvedValue([
      { command: "git status", executedAt: 1000, isCurrentSession: 1, isCurrentCwd: 0 },
      { command: "npm test", executedAt: 999, isCurrentSession: 0, isCurrentCwd: 1 },
      { command: "ls", executedAt: 998, isCurrentSession: 0, isCurrentCwd: 0 },
    ]);

    void service.triggerCommandHistory();
    const view = (await new Promise((resolve) => {
      service.viewState$.subscribe((v) => v.visible && resolve(v));
    })) as { entries: { command: string; origin?: string }[] };

    expect(view.entries).toEqual([
      { command: "git status", executedAt: 1000, origin: "session" },
      { command: "npm test", executedAt: 999, origin: "cwd" },
      { command: "ls", executedAt: 998, origin: undefined },
    ]);
  });

  it("shares the scope across tabs through the store", async () => {
    // A second tab with its own coordinator, but sharing the one scope store.
    const otherCoordinator = new TerminalDropdownCoordinatorService();
    const otherService = new TerminalHistoryService(
      fakeState as unknown as any,
      persistence as unknown as TerminalHistoryPersistenceService,
      otherCoordinator,
      { config: {} } as any,
      scopeStore,
    );

    // First tab opens and cycles the shared scope while the second tab's panel is closed.
    void service.triggerCommandHistory();
    await new Promise((resolve) => {
      service.viewState$.subscribe((v) => v.visible && resolve(v));
    });
    service.cycleTab();

    // The closed second tab silently follows the shared scope...
    const otherView = await new Promise<any>((resolve) => {
      otherService.viewState$.subscribe((v) => v.scope === "cwd" && resolve(v));
    });
    expect(otherView).toMatchObject({ visible: false, scope: "cwd" });

    // ...and opens directly in that scope, querying with its own context.
    persistence.getRecentCommands.mockClear();
    void otherService.triggerCommandHistory();
    await new Promise((resolve) => {
      otherService.viewState$.subscribe((v) => v.visible && resolve(v));
    });
    expect(persistence.getRecentCommands).toHaveBeenLastCalledWith({
      scope: "cwd",
      cwdRaw: "/Users/larswolfram/projects",
    });

    otherService.ngOnDestroy();
  });
});
