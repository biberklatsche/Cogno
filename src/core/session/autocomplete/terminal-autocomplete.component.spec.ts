import { ElementRef, provideZonelessChangeDetection, Signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import { AutocompleteSuggestion, AutocompleteViewState } from "./autocomplete.types";
import { TerminalAutocompleteComponent } from "./terminal-autocomplete.component";
import { SuggestionFilterMode, TerminalAutocompleteService } from "./terminal-autocomplete.service";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/** What the template reads; the members are protected, so the spec looks at them through this. */
type TemplateFacing = {
  viewState: Signal<AutocompleteViewState>;
  filterMode: Signal<SuggestionFilterMode>;
  filterModeLabel: Signal<string>;
  filterModeTooltip: Signal<string>;
  selectedDescription(): string;
  isHistorySuggestion(item: AutocompleteSuggestion): boolean;
  isLocalHistorySuggestion(item: AutocompleteSuggestion): boolean;
  listRef?: ElementRef<HTMLDivElement>;
};

const HIDDEN_VIEW: AutocompleteViewState = {
  visible: false,
  x: 0,
  y: 0,
  width: 280,
  placement: "below",
  selectedIndex: null,
  suggestions: [],
};

function suggestion(overrides: Partial<AutocompleteSuggestion> = {}): AutocompleteSuggestion {
  return {
    label: "git status",
    insertText: "git status",
    score: 10,
    source: "history-cmd",
    replaceStart: 0,
    replaceEnd: 3,
    ...overrides,
  };
}

/**
 * Pins what the dropdown shows from the service's view state, independent of layout, before the
 * hand-rolled virtual scrolling is replaced by a plain list.
 */
describe("TerminalAutocompleteComponent", () => {
  let viewState$: BehaviorSubject<AutocompleteViewState>;
  let filterMode$: BehaviorSubject<SuggestionFilterMode>;
  let component: TemplateFacing;

  beforeEach(() => {
    viewState$ = new BehaviorSubject<AutocompleteViewState>(HIDDEN_VIEW);
    filterMode$ = new BehaviorSubject<SuggestionFilterMode>("all");
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    component = TestBed.runInInjectionContext(
      () =>
        new TerminalAutocompleteComponent({
          viewState$,
          filterMode$,
        } as unknown as TerminalAutocompleteService),
    ) as unknown as TemplateFacing;
  });

  describe("view state", () => {
    it("starts hidden with no suggestions and no selection", () => {
      expect(component.viewState()).toEqual(HIDDEN_VIEW);
    });

    it("exposes visibility, position, width, placement, suggestions and selection as emitted", () => {
      const view: AutocompleteViewState = {
        visible: true,
        x: 120,
        y: 340,
        width: 512,
        placement: "above",
        selectedIndex: 1,
        suggestions: [suggestion({ label: "git status" }), suggestion({ label: "git stash" })],
      };

      viewState$.next(view);

      expect(component.viewState()).toBe(view);
    });

    it("exposes every suggestion of a full list, in order", () => {
      const suggestions = Array.from({ length: 100 }, (_, index) =>
        suggestion({ label: `command-${index}` }),
      );

      viewState$.next({ ...HIDDEN_VIEW, visible: true, suggestions });

      expect(component.viewState().suggestions).toBe(suggestions);
      expect(component.viewState().suggestions.map((item) => item.label)).toEqual(
        suggestions.map((item) => item.label),
      );
    });

    it("follows the selection when only the selected index changes", () => {
      const suggestions = [suggestion(), suggestion({ label: "git stash" })];
      viewState$.next({ ...HIDDEN_VIEW, visible: true, suggestions, selectedIndex: 0 });

      viewState$.next({ ...viewState$.value, selectedIndex: 1 });

      expect(component.viewState().selectedIndex).toBe(1);
      expect(component.viewState().suggestions).toBe(suggestions);
    });
  });

  describe("selected description", () => {
    it("is empty when there are no suggestions", () => {
      viewState$.next({ ...HIDDEN_VIEW, visible: true, selectedIndex: 0 });

      expect(component.selectedDescription()).toBe("");
    });

    it("is empty when nothing is selected", () => {
      viewState$.next({
        ...HIDDEN_VIEW,
        visible: true,
        suggestions: [suggestion({ description: "Show the working tree status" })],
      });

      expect(component.selectedDescription()).toBe("");
    });

    it("is the description of the selected suggestion", () => {
      viewState$.next({
        ...HIDDEN_VIEW,
        visible: true,
        selectedIndex: 1,
        suggestions: [
          suggestion({ description: "Show the working tree status" }),
          suggestion({ label: "git stash", description: "Stash the changes" }),
        ],
      });

      expect(component.selectedDescription()).toBe("Stash the changes");
    });

    it("is empty when the selected suggestion has no description", () => {
      viewState$.next({
        ...HIDDEN_VIEW,
        visible: true,
        selectedIndex: 0,
        suggestions: [suggestion()],
      });

      expect(component.selectedDescription()).toBe("");
    });

    it("is empty when the selected index points past the list", () => {
      viewState$.next({
        ...HIDDEN_VIEW,
        visible: true,
        selectedIndex: 5,
        suggestions: [suggestion({ description: "Show the working tree status" })],
      });

      expect(component.selectedDescription()).toBe("");
    });
  });

  describe("filter mode badge", () => {
    it.each([
      ["all", "All", "Suggestions from history and the current context"],
      ["history-only", "History", "Suggestions from your command history"],
      ["context-only", "Context", "Suggestions based on the current context"],
    ] as const)("labels %s as %s", (mode, label, tooltip) => {
      filterMode$.next(mode);

      expect(component.filterMode()).toBe(mode);
      expect(component.filterModeLabel()).toBe(label);
      expect(component.filterModeTooltip()).toBe(tooltip);
    });
  });

  describe("source dot", () => {
    it.each([
      ["history-cmd", true],
      ["history-cmd-local", true],
      ["history-dir", true],
      ["npm-scripts + history-cmd", true],
      ["History-Cmd", true],
      ["  history-cmd  ", true],
      ["npm-scripts", false],
      ["filesystem + npm-scripts", false],
      ["", false],
    ])("recognises source %j as history: %s", (source, expected) => {
      expect(component.isHistorySuggestion(suggestion({ source }))).toBe(expected);
    });

    it.each([
      ["history-cmd-local", true],
      ["npm-scripts + history-cmd-local", true],
      ["history-cmd-local+history-cmd", true],
      ["history-cmd", false],
      ["History-Cmd-Local", false],
      ["history-cmd-local-extra", false],
      ["npm-scripts", false],
    ])("recognises source %j as local history: %s", (source, expected) => {
      expect(component.isLocalHistorySuggestion(suggestion({ source }))).toBe(expected);
    });
  });

  describe("list scroll position", () => {
    it("jumps back to the top when a new suggestion list arrives", () => {
      const list = document.createElement("div");
      component.listRef = new ElementRef(list);
      viewState$.next({ ...HIDDEN_VIEW, visible: true, suggestions: [suggestion()] });
      TestBed.tick();
      list.scrollTop = 96;

      viewState$.next({
        ...HIDDEN_VIEW,
        visible: true,
        suggestions: [suggestion({ label: "git stash" })],
      });
      TestBed.tick();

      expect(list.scrollTop).toBe(0);
    });

    it("stays where it is when only the selection changes on a hidden panel", () => {
      const list = document.createElement("div");
      component.listRef = new ElementRef(list);
      const suggestions = [suggestion()];
      viewState$.next({ ...HIDDEN_VIEW, suggestions });
      TestBed.tick();
      list.scrollTop = 96;

      viewState$.next({ ...HIDDEN_VIEW, suggestions, selectedIndex: 0 });
      TestBed.tick();

      expect(list.scrollTop).toBe(96);
    });
  });
});
