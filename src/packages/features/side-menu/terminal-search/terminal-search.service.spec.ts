import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TerminalSearchColorConfigContract,
  TerminalSearchHostPortContract,
  TerminalSearchResultContract,
} from "@cogno/core-sdk";
import { AppBus } from "@cogno/app/app-bus/app-bus";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { TerminalSearchService } from "./terminal-search.service";

describe("TerminalSearchService", () => {
  let terminalSearchResultSubject: BehaviorSubject<TerminalSearchResultContract>;
  let terminalSearchColorConfigSubject: BehaviorSubject<TerminalSearchColorConfigContract>;
  let requestSearchMock: ReturnType<typeof vi.fn>;
  let terminalSearchService: TerminalSearchService;
  let appBus: AppBus;

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
    requestSearchMock = vi.fn();
    appBus = new AppBus();

    const terminalSearchHostPort = {
      terminalSearchResult$: terminalSearchResultSubject.asObservable(),
      terminalSearchColorConfig$: terminalSearchColorConfigSubject.asObservable(),
      getFocusedTerminalId: vi.fn().mockReturnValue("focused-terminal"),
      requestSearch: requestSearchMock,
      requestSearchDecorationClear: vi.fn(),
      requestReveal: vi.fn(),
    } as TerminalSearchHostPortContract;

    terminalSearchService = new TerminalSearchService(terminalSearchHostPort, appBus, getDestroyRef());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies block filter parameters from the bus and uses them for the next search", () => {
    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchPanelRequested",
      payload: {
        terminalId: "terminal-77",
        beginBufferLine: 12,
        endBufferLine: 24,
      },
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

  it("updates buffer line filters from the sidebar inputs", () => {
    const beginInputElement = document.createElement("input");
    beginInputElement.value = "5";
    const endInputElement = document.createElement("input");
    endInputElement.value = "18";

    terminalSearchService.updateBeginBufferLine({ target: beginInputElement } as unknown as Event);
    terminalSearchService.updateEndBufferLine({ target: endInputElement } as unknown as Event);
    vi.runAllTimers();

    expect(terminalSearchService.beginBufferLine()).toBe(5);
    expect(terminalSearchService.endBufferLine()).toBe(18);
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
    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchPanelRequested",
      payload: {
        terminalId: "terminal-77",
        beginBufferLine: 12,
        endBufferLine: 24,
      },
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
