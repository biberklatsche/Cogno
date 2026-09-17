import type { TerminalSearchApi } from "@cogno/core/api/terminal-search-api";
import type {
  TerminalSearchColorConfigContract,
  TerminalSearchLineResultContract,
  TerminalSearchPanelRequestContract,
  TerminalSearchResultContract,
} from "@cogno/shared/domain";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { TerminalSearchService } from "./terminal-search.service";
import { TerminalSearchSideMenuLifecycle } from "./terminal-search-side-menu.lifecycle";

vi.mock("@cogno/shared/ui/common/autofocus/focus-side-menu-autofocus-element", () => ({
  focusSideMenuAutofocusElement: vi.fn(),
}));

const lineOne = line(3, "needle one");
const lineTwo = line(8, "needle two");
const lineThree = line(12, "needle three");
const lineFour = line(20, "needle four");

/**
 * Pins what the search panel does as the panel and its side-menu lifecycle use
 * it: keys go in through the registered key listener, terminal answers through
 * the API's result stream.
 */
describe("terminal search behaviour", () => {
  let service: TerminalSearchService;
  let terminalSearchResultSubject: Subject<TerminalSearchResultContract>;
  let terminalSearchColorConfigSubject: Subject<TerminalSearchColorConfigContract>;
  let terminalSearchPanelRequestSubject: Subject<TerminalSearchPanelRequestContract>;
  let getFocusedTerminalIdMock: Mock<() => string | undefined>;
  let requestSearchMock: Mock<TerminalSearchApi["requestSearch"]>;
  let requestRevealMock: Mock<TerminalSearchApi["requestReveal"]>;
  let requestSearchDecorationClearMock: Mock<() => void>;
  let closeMock: Mock<() => void>;
  let press: (key: string) => void;

  /** Types a query, lets the debounce pass and answers like the terminal would. */
  const search = (query: string, lines: TerminalSearchLineResultContract[]) => {
    service.submitSearchQuery(query);
    vi.runAllTimers();
    answer({ lines });
  };

  /** An answer for the search the panel is currently showing, unless overridden. */
  const answer = (overrides: Partial<TerminalSearchResultContract>) => {
    terminalSearchResultSubject.next({
      terminalId: "terminal-1",
      query: service.searchQuery().trim(),
      caseSensitive: service.caseSensitive(),
      regularExpression: service.regularExpression(),
      beginBufferLine: service.beginBufferLine(),
      endBufferLine: service.endBufferLine(),
      hasMore: false,
      lines: [],
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    terminalSearchResultSubject = new Subject();
    terminalSearchColorConfigSubject = new Subject();
    terminalSearchPanelRequestSubject = new Subject();
    getFocusedTerminalIdMock = vi.fn().mockReturnValue("terminal-1");
    requestSearchMock = vi.fn();
    requestRevealMock = vi.fn();
    requestSearchDecorationClearMock = vi.fn();

    service = new TerminalSearchService(
      {
        terminalSearchResult$: terminalSearchResultSubject.asObservable(),
        terminalSearchColorConfig$: terminalSearchColorConfigSubject.asObservable(),
        terminalSearchPanelRequest$: terminalSearchPanelRequestSubject.asObservable(),
        getFocusedTerminalId: getFocusedTerminalIdMock,
        requestSearch: requestSearchMock,
        requestSearchDecorationClear: requestSearchDecorationClearMock,
        requestReveal: requestRevealMock,
      } as unknown as TerminalSearchApi,
      getDestroyRef(),
    );

    const lifecycle = new TerminalSearchSideMenuLifecycle(service);
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

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("requests", () => {
    it("searches the focused terminal once typing pauses", () => {
      service.submitSearchQuery("n");
      service.submitSearchQuery("needle");

      expect(service.searchQuery()).toBe("needle");
      expect(requestSearchMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(119);
      expect(requestSearchMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(requestSearchMock).toHaveBeenCalledTimes(1);
      expect(requestSearchMock).toHaveBeenCalledWith({
        terminalId: "terminal-1",
        query: "needle",
        caseSensitive: false,
        regularExpression: false,
        beginBufferLine: undefined,
        endBufferLine: undefined,
        cursorBufferLine: undefined,
        resultLineLimit: 200,
      });
    });

    it("sends the query untrimmed", () => {
      service.submitSearchQuery(" needle ");
      vi.runAllTimers();

      expect(requestSearchMock).toHaveBeenCalledWith(
        expect.objectContaining({ query: " needle " }),
      );
    });

    it("keeps searching the terminal it started with until the panel closes", () => {
      search("needle", [lineOne]);
      getFocusedTerminalIdMock.mockReturnValue("terminal-2");

      service.submitSearchQuery("needles");
      vi.runAllTimers();
      expect(requestSearchMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ terminalId: "terminal-1", query: "needles" }),
      );

      service.handleSideMenuClose();
      service.submitSearchQuery("needle");
      vi.runAllTimers();
      expect(requestSearchMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ terminalId: "terminal-2", query: "needle" }),
      );
    });

    it("requests nothing and shows no results when there is no terminal", () => {
      getFocusedTerminalIdMock.mockReturnValue(undefined);

      service.submitSearchQuery("needle");
      vi.runAllTimers();

      expect(requestSearchMock).not.toHaveBeenCalled();
      expect(service.searchResults()).toEqual([]);
      expect(service.selectedSearchResultId()).toBeUndefined();
    });

    it("toggles case sensitivity and searches again right away", () => {
      search("needle", [lineOne]);
      requestSearchMock.mockClear();

      service.toggleCaseSensitive();

      expect(service.caseSensitive()).toBe(true);
      expect(requestSearchMock).toHaveBeenCalledTimes(1);
      expect(requestSearchMock).toHaveBeenCalledWith(
        expect.objectContaining({ caseSensitive: true, regularExpression: false }),
      );

      service.toggleCaseSensitive();
      expect(service.caseSensitive()).toBe(false);
    });

    it("toggles regular expressions and searches again right away", () => {
      search("needle", [lineOne]);
      requestSearchMock.mockClear();

      service.toggleRegularExpression();

      expect(service.regularExpression()).toBe(true);
      expect(requestSearchMock).toHaveBeenCalledTimes(1);
      expect(requestSearchMock).toHaveBeenCalledWith(
        expect.objectContaining({ caseSensitive: false, regularExpression: true }),
      );
    });

    it("drops a pending debounced search when a toggle searches right away", () => {
      service.submitSearchQuery("needle");

      service.toggleCaseSensitive();
      vi.runAllTimers();

      expect(requestSearchMock).toHaveBeenCalledTimes(1);
    });

    it("searches right away on open when there is a query, and not without one", () => {
      service.handleSideMenuOpen();
      expect(requestSearchMock).not.toHaveBeenCalled();

      service.submitSearchQuery("needle");
      service.handleSideMenuOpen();

      expect(requestSearchMock).toHaveBeenCalledTimes(1);
      expect(requestSearchMock).toHaveBeenCalledWith(expect.objectContaining({ query: "needle" }));
    });
  });

  describe("results", () => {
    it("shows the answer and replaces it with the next one", () => {
      search("needle", [lineOne, lineTwo]);
      expect(service.searchResults()).toEqual([lineOne, lineTwo]);

      answer({ lines: [lineThree], hasMore: true, nextCursorBufferLine: 40 });

      expect(service.searchResults()).toEqual([lineThree]);
      expect(service.hasMoreResults()).toBe(true);
    });

    it("accepts an answer for the trimmed query", () => {
      service.submitSearchQuery(" needle ");
      vi.runAllTimers();

      answer({ query: "needle", lines: [lineOne] });

      expect(service.searchResults()).toEqual([lineOne]);
    });

    it("ignores every answer before the first search was requested", () => {
      service.submitSearchQuery("needle");

      answer({ lines: [lineOne] });

      expect(service.searchResults()).toEqual([]);
    });

    it.each<[string, Partial<TerminalSearchResultContract>]>([
      ["another terminal", { terminalId: "terminal-2" }],
      ["an older query", { query: "needl" }],
      ["the untrimmed query", { query: "needle " }],
      ["another case sensitivity", { caseSensitive: true }],
      ["another regular expression mode", { regularExpression: true }],
      ["another block start", { beginBufferLine: 1 }],
      ["another block end", { endBufferLine: 99 }],
    ])("ignores an answer for %s", (_name, staleFields) => {
      service.submitSearchQuery("needle ");
      vi.runAllTimers();
      answer({ lines: [lineOne], hasMore: true, nextCursorBufferLine: 40 });

      answer({ lines: [lineTwo, lineThree], hasMore: false, ...staleFields });

      expect(service.searchResults()).toEqual([lineOne]);
      expect(service.hasMoreResults()).toBe(true);
      expect(service.selectedSearchResultId()).toBe(idOf(lineOne));
    });

    it("ignores the answer to the previous query while the next one is still debounced", () => {
      search("needle", [lineOne]);

      service.submitSearchQuery("needles");
      answer({ query: "needle", lines: [lineOne, lineTwo] });

      // The old list stays until the new query is answered.
      expect(service.searchResults()).toEqual([lineOne]);

      vi.runAllTimers();
      answer({ lines: [] });

      expect(service.searchResults()).toEqual([]);
    });

    it("ignores an answer with the old flags after a toggle", () => {
      search("needle", [lineOne]);

      service.toggleCaseSensitive();
      answer({ caseSensitive: false, lines: [lineOne, lineTwo] });

      expect(service.searchResults()).toEqual([lineOne]);
    });
  });

  describe("load more", () => {
    it("requests the next page from the cursor and appends it", () => {
      search("needle", []);
      answer({ lines: [lineOne, lineTwo], hasMore: true, nextCursorBufferLine: 40 });
      requestSearchMock.mockClear();

      service.loadMoreSearchResults();

      expect(requestSearchMock).toHaveBeenCalledTimes(1);
      expect(requestSearchMock).toHaveBeenCalledWith(
        expect.objectContaining({ query: "needle", cursorBufferLine: 40, resultLineLimit: 200 }),
      );

      answer({ cursorBufferLine: 40, lines: [lineThree], hasMore: false });

      expect(service.searchResults()).toEqual([lineOne, lineTwo, lineThree]);
      expect(service.hasMoreResults()).toBe(false);

      // Without a cursor there is nothing more to ask for.
      requestSearchMock.mockClear();
      service.loadMoreSearchResults();
      expect(requestSearchMock).not.toHaveBeenCalled();
    });

    it("keeps the selection where it is when a page is appended", () => {
      search("needle", []);
      answer({ lines: [lineOne, lineTwo], hasMore: true, nextCursorBufferLine: 40 });
      expect(service.selectedSearchResultId()).toBe(idOf(lineTwo));

      service.loadMoreSearchResults();
      answer({ cursorBufferLine: 40, lines: [lineThree] });

      expect(service.selectedSearchResultId()).toBe(idOf(lineTwo));
    });
  });

  describe("selection", () => {
    it("selects the last result, which the panel shows on top", () => {
      search("needle", [lineOne, lineTwo, lineThree]);

      expect(service.selectedSearchResultId()).toBe("12:needle three");
    });

    it("moves down the reversed list with ArrowDown and back with ArrowUp", () => {
      search("needle", [lineOne, lineTwo, lineThree]);

      press("ArrowDown");
      expect(service.selectedSearchResultId()).toBe(idOf(lineTwo));

      press("ArrowDown");
      expect(service.selectedSearchResultId()).toBe(idOf(lineOne));

      press("ArrowUp");
      expect(service.selectedSearchResultId()).toBe(idOf(lineTwo));
    });

    it("wraps around at both ends", () => {
      search("needle", [lineOne, lineTwo, lineThree]);

      press("ArrowUp");
      expect(service.selectedSearchResultId()).toBe(idOf(lineOne));

      press("ArrowDown");
      expect(service.selectedSearchResultId()).toBe(idOf(lineThree));
    });

    it("stays on a single result and ignores the arrow keys without results", () => {
      search("needle", []);
      press("ArrowDown");
      expect(service.selectedSearchResultId()).toBeUndefined();

      answer({ lines: [lineOne] });
      press("ArrowDown");
      press("ArrowUp");
      expect(service.selectedSearchResultId()).toBe(idOf(lineOne));
    });

    it("keeps the selected line when the list is refreshed and still has it", () => {
      search("needle", [lineOne, lineTwo, lineThree]);
      press("ArrowDown");

      answer({ lines: [lineTwo, lineThree, lineFour] });

      expect(service.selectedSearchResultId()).toBe(idOf(lineTwo));
    });

    it("falls back to the last result when the selected line is gone", () => {
      search("needle", [lineOne, lineTwo, lineThree]);
      press("ArrowDown");
      press("ArrowDown");
      expect(service.selectedSearchResultId()).toBe(idOf(lineOne));

      answer({ lines: [lineTwo, lineThree] });

      expect(service.selectedSearchResultId()).toBe(idOf(lineThree));
    });

    it("does not return to a line that was gone in between", () => {
      search("needle", [lineOne, lineTwo, lineThree]);
      press("ArrowDown");
      press("ArrowDown");

      answer({ lines: [lineTwo, lineThree] });
      answer({ lines: [lineOne, lineTwo, lineThree, lineFour] });

      expect(service.selectedSearchResultId()).toBe(idOf(lineThree));
    });

    it("has no selection without results and starts over at the last result", () => {
      search("needle", [lineOne, lineTwo, lineThree]);
      press("ArrowDown");

      answer({ lines: [] });
      expect(service.selectedSearchResultId()).toBeUndefined();

      answer({ lines: [lineOne, lineTwo, lineThree] });
      expect(service.selectedSearchResultId()).toBe(idOf(lineThree));
    });
  });

  describe("reveal", () => {
    it("reveals the first match of the selected line on Enter", () => {
      service.submitSearchQuery(" needle ");
      vi.runAllTimers();
      answer({
        lines: [
          { lineNumber: 3, lineText: "a needle, needle", matches: [match(2, 8), match(10, 16)] },
          lineTwo,
        ],
      });
      press("ArrowDown");
      requestSearchMock.mockClear();

      press("Enter");

      expect(requestRevealMock).toHaveBeenCalledTimes(1);
      expect(requestRevealMock).toHaveBeenCalledWith({
        terminalId: "terminal-1",
        query: "needle",
        caseSensitive: false,
        regularExpression: false,
        lineNumber: 3,
        matchStartIndex: 2,
        matchLength: 6,
      });
      expect(requestSearchMock).not.toHaveBeenCalled();
      expect(closeMock).not.toHaveBeenCalled();
    });

    it("reveals the default selection on Enter", () => {
      search("needle", [lineOne, lineTwo]);

      press("Enter");

      expect(requestRevealMock).toHaveBeenCalledWith(expect.objectContaining({ lineNumber: 8 }));
    });

    it("selects and reveals a clicked line", () => {
      search("needle", [lineOne, lineTwo, lineThree]);

      service.revealSearchResult(lineOne);

      expect(service.selectedSearchResultId()).toBe(idOf(lineOne));
      expect(requestRevealMock).toHaveBeenCalledWith(expect.objectContaining({ lineNumber: 3 }));

      press("ArrowUp");
      expect(service.selectedSearchResultId()).toBe(idOf(lineTwo));
    });

    it("selects a line without matches but has nothing to reveal", () => {
      const lineWithoutMatches = { lineNumber: 5, lineText: "plain", matches: [] };
      search("needle", [lineWithoutMatches, lineTwo]);

      service.revealSearchResult(lineWithoutMatches);

      expect(service.selectedSearchResultId()).toBe("5:plain");
      expect(requestRevealMock).not.toHaveBeenCalled();
    });

    it("repeats the search on Enter when there is nothing to reveal", () => {
      search("needle", []);
      service.submitSearchQuery("needles");
      requestSearchMock.mockClear();

      press("Enter");
      vi.runAllTimers();

      expect(requestRevealMock).not.toHaveBeenCalled();
      expect(requestSearchMock).toHaveBeenCalledTimes(1);
      expect(requestSearchMock).toHaveBeenCalledWith(
        expect.objectContaining({ query: "needles", cursorBufferLine: undefined }),
      );
    });
  });

  describe("block search", () => {
    it("takes terminal and block from a panel request and empties the list", () => {
      search("needle", []);
      answer({ lines: [lineOne, lineTwo], hasMore: true, nextCursorBufferLine: 40 });
      requestSearchMock.mockClear();

      terminalSearchPanelRequestSubject.next({
        terminalId: "terminal-7",
        beginBufferLine: 10,
        endBufferLine: 20,
      });

      expect(service.isBlockSearchActive()).toBe(true);
      expect(service.beginBufferLine()).toBe(10);
      expect(service.endBufferLine()).toBe(20);
      expect(service.searchQuery()).toBe("needle");
      expect(service.searchResults()).toEqual([]);
      expect(service.hasMoreResults()).toBe(false);
      expect(service.selectedSearchResultId()).toBeUndefined();
      // The request itself does not search; opening the panel does.
      expect(requestSearchMock).not.toHaveBeenCalled();

      service.loadMoreSearchResults();
      expect(requestSearchMock).not.toHaveBeenCalled();

      service.handleSideMenuOpen();
      expect(requestSearchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          terminalId: "terminal-7",
          query: "needle",
          beginBufferLine: 10,
          endBufferLine: 20,
        }),
      );
    });

    it("is active with only one bound", () => {
      terminalSearchPanelRequestSubject.next({ terminalId: "terminal-7", endBufferLine: 20 });

      expect(service.isBlockSearchActive()).toBe(true);
    });

    it("falls back to the focused terminal when a panel request names none", () => {
      search("needle", [lineOne]);
      getFocusedTerminalIdMock.mockReturnValue("terminal-2");

      terminalSearchPanelRequestSubject.next({});
      service.handleSideMenuOpen();

      expect(service.isBlockSearchActive()).toBe(false);
      expect(requestSearchMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ terminalId: "terminal-2" }),
      );
    });

    it("clears the block, keeps the terminal and the shown results, and searches again", () => {
      terminalSearchPanelRequestSubject.next({
        terminalId: "terminal-7",
        beginBufferLine: 10,
        endBufferLine: 20,
      });
      service.submitSearchQuery("needle");
      vi.runAllTimers();
      answer({ terminalId: "terminal-7", lines: [lineThree] });
      requestSearchMock.mockClear();

      service.clearBlockSearch();

      expect(service.isBlockSearchActive()).toBe(false);
      expect(service.searchResults()).toEqual([lineThree]);
      expect(requestSearchMock).toHaveBeenCalledTimes(1);
      expect(requestSearchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          terminalId: "terminal-7",
          beginBufferLine: undefined,
          endBufferLine: undefined,
        }),
      );
    });

    it("does nothing when there is no block to clear", () => {
      search("needle", [lineOne]);
      requestSearchMock.mockClear();

      service.clearBlockSearch();

      expect(requestSearchMock).not.toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("closes on Escape", () => {
      press("Escape");

      expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it("drops the pending search, the decorations and the whole search state", () => {
      terminalSearchPanelRequestSubject.next({
        terminalId: "terminal-1",
        beginBufferLine: 10,
        endBufferLine: 20,
      });
      service.submitSearchQuery("needle");
      vi.runAllTimers();
      service.toggleCaseSensitive();
      service.toggleRegularExpression();
      answer({ lines: [lineOne, lineTwo], hasMore: true, nextCursorBufferLine: 40 });
      press("ArrowDown");
      service.submitSearchQuery("needles");
      requestSearchMock.mockClear();

      service.handleSideMenuClose();
      vi.runAllTimers();

      expect(requestSearchMock).not.toHaveBeenCalled();
      expect(requestSearchDecorationClearMock).toHaveBeenCalledTimes(1);
      expect(service.searchQuery()).toBe("");
      expect(service.searchResults()).toEqual([]);
      expect(service.selectedSearchResultId()).toBeUndefined();
      expect(service.caseSensitive()).toBe(false);
      expect(service.regularExpression()).toBe(false);
      expect(service.isBlockSearchActive()).toBe(false);
      expect(service.hasMoreResults()).toBe(false);

      service.loadMoreSearchResults();
      expect(requestSearchMock).not.toHaveBeenCalled();
    });

    it("ignores a late answer after closing", () => {
      search("needle", [lineOne]);

      service.handleSideMenuClose();
      answer({ query: "needle", lines: [lineOne, lineTwo] });

      expect(service.searchResults()).toEqual([]);
    });
  });

  describe("match colours", () => {
    it("uses the configured colours, adds a missing # and falls back to the theme", () => {
      const defaultBackgroundColor = service.matchBackgroundColor();
      const defaultBorderColor = service.matchBorderColor();
      expect(defaultBorderColor).toBe("var(--highlight-color)");

      terminalSearchColorConfigSubject.next({
        matchBackgroundColor: "ff0000",
        matchBorderColor: "#00ff00",
      });
      expect(service.matchBackgroundColor()).toBe("#ff0000");
      expect(service.matchBorderColor()).toBe("#00ff00");

      terminalSearchColorConfigSubject.next({ matchBackgroundColor: " ", matchBorderColor: "" });
      expect(service.matchBackgroundColor()).toBe(defaultBackgroundColor);
      expect(service.matchBorderColor()).toBe(defaultBorderColor);
    });
  });
});

function match(startIndex: number, endIndex: number) {
  return { startIndex, endIndex };
}

function line(lineNumber: number, lineText: string): TerminalSearchLineResultContract {
  return { lineNumber, lineText, matches: [match(0, 6)] };
}

/** The id the panel tracks a result line by. */
function idOf(searchLine: TerminalSearchLineResultContract): string {
  return `${searchLine.lineNumber}:${searchLine.lineText}`;
}
