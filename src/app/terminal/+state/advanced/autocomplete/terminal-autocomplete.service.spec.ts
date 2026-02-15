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
    id = "dummy";
    inputPattern = /.+/;
    constructor(private readonly fn: (context: QueryContext) => Promise<AutocompleteSuggestion[]>) {}
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

        fakeState.emit({ ...fakeState.state, input: { text: "git s", cursorIndex: 5, maxCursorIndex: 5 } });
        await vi.advanceTimersByTimeAsync(400);

        const view = (service as any)._viewState.value;
        expect(view.visible).toBe(true);
        expect(view.selectedIndex).toBeNull();
        expect(view.suggestions.map((s: any) => s.label)).toEqual(["git status"]);
    });

    it("Enter without selection does not apply a suggestion", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [makeSuggestion("git status")]));
        fakeState.emit({ ...fakeState.state });
        await vi.advanceTimersByTimeAsync(400);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

        expect((bus.publish as any).mock.calls.some((c: any[]) => c[0]?.type === "ApplyAutocompleteSuggestion")).toBe(false);
    });

    it("ArrowDown then Enter applies selected suggestion", async () => {
        service.registerSuggestor(new DummySuggestor(async () => [makeSuggestion("git status")]));
        fakeState.emit({ ...fakeState.state });
        await vi.advanceTimersByTimeAsync(400);

        const viewBefore = (service as any)._viewState.value;
        expect(viewBefore.visible).toBe(true);
        expect(viewBefore.selectedIndex).toBeNull();

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

        expect((bus.publish as any).mock.calls.some((c: any[]) => c[0]?.type === "ApplyAutocompleteSuggestion")).toBe(true);
    });

    it("positions panel above cursor near bottom and keeps it in viewport", async () => {
        service.registerSuggestor(new DummySuggestor(async () =>
            Array.from({ length: 20 }, (_, i) => makeSuggestion(`git status ${i}`))
        ));
        fakeState.emit({
            ...fakeState.state,
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
    });
});
