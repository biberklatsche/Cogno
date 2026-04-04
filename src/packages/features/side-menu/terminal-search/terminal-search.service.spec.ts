import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TerminalSearchColorConfigContract,
  TerminalSearchHostPortContract,
  TerminalSearchPanelRequestContract,
  TerminalSearchResultContract,
} from "@cogno/core-api";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { TerminalSearchService } from "./terminal-search.service";

describe("TerminalSearchService", () => {
  let terminalSearchResultSubject: BehaviorSubject<TerminalSearchResultContract>;
  let terminalSearchColorConfigSubject: BehaviorSubject<TerminalSearchColorConfigContract>;
  let terminalSearchPanelRequestSubject: BehaviorSubject<TerminalSearchPanelRequestContract>;
  let requestSearchMock: ReturnType<typeof vi.fn>;
  let terminalSearchService: TerminalSearchService;

  beforeEach(() => {
    vi.useFakeTimers();
    terminalSearchResultSubject = new BehaviorSubject<TerminalSearchResultContract>({
      terminalId: "terminal-1",
      query: "",
      caseSensitive: false,
      regularExpression: false,
      hasMore: false,
      lines: [],
    });
    terminalSearchColorConfigSubject = new BehaviorSubject<TerminalSearchColorConfigContract>({});
    terminalSearchPanelRequestSubject = new BehaviorSubject<TerminalSearchPanelRequestContract>({});
    requestSearchMock = vi.fn();

    const terminalSearchHostPort = {
      terminalSearchResult$: terminalSearchResultSubject.asObservable(),
      terminalSearchColorConfig$: terminalSearchColorConfigSubject.asObservable(),
      terminalSearchPanelRequest$: terminalSearchPanelRequestSubject.asObservable(),
      getFocusedTerminalId: vi.fn().mockReturnValue("focused-terminal"),
      requestSearch: requestSearchMock,
      requestSearchDecorationClear: vi.fn(),
      requestReveal: vi.fn(),
    } as TerminalSearchHostPortContract;

    terminalSearchService = new TerminalSearchService(terminalSearchHostPort, getDestroyRef());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies block search parameters from the bus and uses them for the next search", () => {
    terminalSearchPanelRequestSubject.next({
      terminalId: "terminal-77",
      beginBufferLine: 12,
      endBufferLine: 24,
    });

    terminalSearchService.submitSearchQuery("needle");
    vi.runAllTimers();

    expect(requestSearchMock).toHaveBeenCalledWith({
      terminalId: "terminal-77",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      beginBufferLine: 12,
      endBufferLine: 24,
      cursorBufferLine: undefined,
      resultLineLimit: 200,
    });
  });

  it("clears an active block search and repeats the search without block bounds", () => {
    terminalSearchPanelRequestSubject.next({
      terminalId: "terminal-77",
      beginBufferLine: 5,
      endBufferLine: 18,
    });

    terminalSearchService.submitSearchQuery("needle");
    vi.runAllTimers();
    requestSearchMock.mockClear();

    terminalSearchService.clearBlockSearch();

    expect(terminalSearchService.isBlockSearchActive()).toBe(false);
    expect(requestSearchMock).toHaveBeenCalledWith({
      terminalId: "terminal-77",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      beginBufferLine: undefined,
      endBufferLine: undefined,
      cursorBufferLine: undefined,
      resultLineLimit: 200,
    });
  });

  it("debounces repeated search input before requesting a new search", () => {
    terminalSearchService.submitSearchQuery("n");
    terminalSearchService.submitSearchQuery("ne");
    terminalSearchService.submitSearchQuery("needle");

    expect(requestSearchMock).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(requestSearchMock).toHaveBeenCalledTimes(1);
    expect(requestSearchMock).toHaveBeenCalledWith(expect.objectContaining({
      query: "needle",
      resultLineLimit: 200,
    }));
  });

  it("appends the next page when more results are loaded", () => {
    terminalSearchPanelRequestSubject.next({
      terminalId: "terminal-77",
      beginBufferLine: 12,
      endBufferLine: 24,
    });

    terminalSearchService.submitSearchQuery("needle");
    vi.runAllTimers();

    terminalSearchResultSubject.next({
      terminalId: "terminal-77",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      beginBufferLine: 12,
      endBufferLine: 24,
      hasMore: true,
      nextCursorBufferLine: 20,
      lines: [
        {
          lineNumber: 14,
          lineText: "needle one",
          matches: [{ startIndex: 0, endIndex: 6 }],
        },
      ],
    });

    terminalSearchService.loadMoreSearchResults();

    expect(requestSearchMock).toHaveBeenLastCalledWith(expect.objectContaining({
      cursorBufferLine: 20,
      resultLineLimit: 200,
    }));

    terminalSearchResultSubject.next({
      terminalId: "terminal-77",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      beginBufferLine: 12,
      endBufferLine: 24,
      cursorBufferLine: 20,
      hasMore: false,
      lines: [
        {
          lineNumber: 21,
          lineText: "needle two",
          matches: [{ startIndex: 0, endIndex: 6 }],
        },
      ],
    });

    expect(terminalSearchService.searchResults()).toHaveLength(2);
    expect(terminalSearchService.hasMoreResults()).toBe(false);
  });
});



