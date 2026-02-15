import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

import { AppBus } from "../../../../app-bus/app-bus";
import { TerminalState } from "../../state";
import { TerminalHistoryPersistenceService } from "../history/terminal-history-persistence.service";
import { AutocompleteSuggestion, QueryContext } from "./autocomplete.types";
import { TerminalAutocompleteService } from "./terminal-autocomplete.service";
import { TerminalAutocompleteSuggestor } from "./suggestors/terminal-autocomplete.suggestor";

class FakeStateManager {
    private readonly subject = new BehaviorSubject<TerminalState>({
        terminalId: "t1",
        shellContext: { shellType: "Bash", backendOs: "macos" } as any,
        cursorPosition: { viewport: { col: 1, row: 1 }, col: 1, row: 1, char: "" },
        mousePosition: { viewport: { col: 1, row: 1 }, col: 1, row: 1, char: "" },
        dimensions: { rows: 24, cols: 80, cellHeight: 18, cellWidth: 9, viewportWidth: 720, viewportHeight: 432 },
        isFocused: true,
        isCommandRunning: false,
        isInFullScreenMode: false,
        commandStartTime: undefined,
        input: { text: "git s", cursorIndex: 5, maxCursorIndex: 5 },
        cwd: "/Users/larswolfram/projects",
    });

    get state$() { return this.subject.asObservable(); }
    get isFocused() { return this.subject.value.isFocused; }
    get state() { return this.subject.value; }
    get input() { return this.subject.value.input; }
    get terminalId() { return this.subject.value.terminalId; }

    emit(next: TerminalState) { this.subject.next(next); }
}

function makeSuggestion(label: string): AutocompleteSuggestion {
    return {
        label,
        insertText: label,
        detail: "",
        score: 10,
        source: "test",
        kind: "command",
        replaceStart: 0,
        replaceEnd: 5,
    };
}

class DummySuggestor implements TerminalAutocompleteSuggestor {
    id: string;
    inputPattern = /.+/;
    constructor(
        private readonly fn: (context: QueryContext) => Promise<AutocompleteSuggestion[]>,
        id: string = "dummy"
    ) {
        this.id = id;
    }
    matches(): boolean { return true; }
    suggest(context: QueryContext): Promise<AutocompleteSuggestion[]> { return this.fn(context); }
}

describe("TerminalAutocompleteService", () => {
    let fakeState: FakeStateManager;
    let bus: AppBus;
    let service: TerminalAutocompleteService;

    beforeEach(() => {
        vi.useFakeTimers();
        fakeState = new FakeStateManager();
        bus = new AppBus();
        vi.spyOn(bus, "publish");
        const persistence = {
            searchDirectories: vi.fn().mockResolvedValue([]),
            searchCommands: vi.fn().mockResolvedValue([]),
            markDirectorySelected: vi.fn(),
            markCommandSelected: vi.fn(),
        } as unknown as TerminalHistoryPersistenceService;
        service = new TerminalAutocompleteService(
            fakeState as unknown as any,
            persistence,
            bus
        );
        (service as any)._suggestors = [];
    });

    afterEach(() => {
        service.ngOnDestroy();
        vi.useRealTimers();
    });

    it("does not preselect a suggestion and filters suggestion equal to current input", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [
            makeSuggestion("git s"),
            makeSuggestion("git status"),
        ]));

        fakeState.emit({ ...fakeState.state, input: { text: "git st", cursorIndex: 6, maxCursorIndex: 6 } });
        await vi.advanceTimersByTimeAsync(400);

        const view = (service as any)._viewState.value;
        expect(view.visible).toBe(true);
        expect(view.selectedIndex).toBeNull();
        expect(view.suggestions.map((s: any) => s.label)).toEqual(["git status"]);
    });

    it("Enter without selection does not apply a suggestion", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [makeSuggestion("git status")]));
        fakeState.emit({ ...fakeState.state, input: { text: "git st", cursorIndex: 6, maxCursorIndex: 6 } });
        await vi.advanceTimersByTimeAsync(400);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

        expect((bus.publish as any).mock.calls.some((c: any[]) => c[0]?.type === "ApplyAutocompleteSuggestion")).toBe(false);
    });

    it("ArrowDown then Enter applies selected suggestion", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [makeSuggestion("git status")]));
        fakeState.emit({ ...fakeState.state, input: { text: "git st", cursorIndex: 6, maxCursorIndex: 6 } });
        await vi.advanceTimersByTimeAsync(400);

        const viewBefore = (service as any)._viewState.value;
        expect(viewBefore.visible).toBe(true);
        expect(viewBefore.selectedIndex).toBeNull();

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

        expect((bus.publish as any).mock.calls.some((c: any[]) => c[0]?.type === "ApplyAutocompleteSuggestion")).toBe(true);
    });

    it("positions panel above cursor near bottom and keeps it in viewport", async () => {
        const originalWidth = window.innerWidth;
        const originalHeight = window.innerHeight;
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 220 });

        service.registerSuggestor(new DummySuggestor(async () =>
            Array.from({ length: 20 }, (_, i) => makeSuggestion(`git status ${i}`))
        ));
        fakeState.emit({
            ...fakeState.state,
            input: { text: "git st", cursorIndex: 6, maxCursorIndex: 6 },
            cursorPosition: {
                ...fakeState.state.cursorPosition,
                viewport: { col: 80, row: 24 },
            },
            dimensions: {
                ...fakeState.state.dimensions,
                viewportWidth: 360,
                viewportHeight: 220,
            }
        });
        await vi.advanceTimersByTimeAsync(400);

        const view = (service as any)._viewState.value;
        expect(view.visible).toBe(true);
        expect(view.x).toBeGreaterThanOrEqual(0);
        expect(view.y).toBeGreaterThanOrEqual(0);
        // Must be above the cursor region when there is no room below.
        expect(view.y).toBeLessThan(24 * 18);

        Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
    });

    it("hides autocomplete when side menu opens", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [makeSuggestion("git status")]));
        fakeState.emit({ ...fakeState.state, input: { text: "git st", cursorIndex: 6, maxCursorIndex: 6 } });
        await vi.advanceTimersByTimeAsync(400);

        expect((service as any)._viewState.value.visible).toBe(true);

        bus.publish({ type: "SideMenuViewOpened", payload: { label: "Command Palette" } } as any);
        expect((service as any)._viewState.value.visible).toBe(true);
    });

    it("stays open while side menu is open", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [makeSuggestion("git status")]));
        bus.publish({ type: "SideMenuViewOpened", payload: { label: "Command Palette" } } as any);

        fakeState.emit({ ...fakeState.state, input: { text: "git st", cursorIndex: 6, maxCursorIndex: 6 } });
        await vi.advanceTimersByTimeAsync(400);

        expect((service as any)._viewState.value.visible).toBe(true);
    });

    it("does not open on mouse move without input change", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [makeSuggestion("git status")]));
        fakeState.emit({
            ...fakeState.state,
            mousePosition: { viewport: { col: 10, row: 5 }, col: 10, row: 5, char: " " },
        });
        await vi.advanceTimersByTimeAsync(400);

        expect((service as any)._viewState.value.visible).toBe(false);
    });

    it("marks matching query parts for highlighting", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [{
            label: "Projects",
            insertText: "Projects",
            detail: "",
            score: 10,
            source: "test",
            kind: "directory",
            replaceStart: 3,
            replaceEnd: 6,
        }]));

        fakeState.emit({
            ...fakeState.state,
            input: { text: "cd pro", cursorIndex: 6, maxCursorIndex: 6 },
        });
        await vi.advanceTimersByTimeAsync(400);

        const view = (service as any)._viewState.value;
        expect(view.visible).toBe(true);
        expect(view.suggestions[0].matchRanges).toEqual([{ start: 0, end: 3 }]);
    });

    it("keeps missing typed separator when applying cd suggestion", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [{
            label: "projects",
            insertText: "projects",
            detail: "",
            score: 10,
            source: "test",
            kind: "directory",
            replaceStart: 3,
            replaceEnd: 3,
            selectedPath: "/Users/larswolfram/projects",
        }]));

        fakeState.emit({
            ...fakeState.state,
            input: { text: "cd", cursorIndex: 3, maxCursorIndex: 3 },
        });
        await vi.advanceTimersByTimeAsync(400);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

        const applyCall = (bus.publish as any).mock.calls.find((c: any[]) => c[0]?.type === "ApplyAutocompleteSuggestion");
        expect(applyCall).toBeTruthy();
        expect(applyCall[0].payload.inputText).toBe("cd projects");
    });

    it("does not open from ArrowUp history recall, only after typing", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [makeSuggestion("npm test")]));

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
        fakeState.emit({
            ...fakeState.state,
            input: { text: "npm test", cursorIndex: 8, maxCursorIndex: 8 },
        });
        await vi.advanceTimersByTimeAsync(400);
        expect((service as any)._viewState.value.visible).toBe(false);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", bubbles: true, cancelable: true }));
        fakeState.emit({
            ...fakeState.state,
            input: { text: "npm test t", cursorIndex: 10, maxCursorIndex: 10 },
        });
        await vi.advanceTimersByTimeAsync(400);
        expect((service as any)._viewState.value.visible).toBe(true);
    });

    it("merges identical suggestions from different sources", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [{
            label: "git status",
            insertText: "git status",
            detail: "from history",
            score: 40,
            source: "history-cmd",
            kind: "command",
            replaceStart: 0,
            replaceEnd: 6,
            selectedCommand: "git status",
        }], "dummy-history"));
        service.registerSuggestor(new DummySuggestor(async () => [{
            label: "git status",
            insertText: "git status",
            detail: "from spec",
            score: 50,
            source: "spec-cmd",
            kind: "command",
            replaceStart: 0,
            replaceEnd: 6,
            selectedCommand: "git status",
        }], "dummy-spec"));

        fakeState.emit({ ...fakeState.state, input: { text: "git st", cursorIndex: 6, maxCursorIndex: 6 } });
        await vi.advanceTimersByTimeAsync(400);

        const view = (service as any)._viewState.value;
        expect(view.suggestions).toHaveLength(1);
        expect(view.suggestions[0].label).toBe("git status");
        expect(view.suggestions[0].source).toBe("history-cmd + spec-cmd");
        expect(view.suggestions[0].score).toBe(58);
    });
});
