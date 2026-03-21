import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    terminalSearchResultSubject = new BehaviorSubject<TerminalSearchResultContract>({
      terminalId: "terminal-1",
      query: "",
      caseSensitive: false,
      regularExpression: false,
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

    expect(requestSearchMock).toHaveBeenCalledWith({
      terminalId: "terminal-77",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      beginBufferLine: 12,
      endBufferLine: 24,
    });
  });

  it("updates buffer line filters from the sidebar inputs", () => {
    const beginInputElement = document.createElement("input");
    beginInputElement.value = "5";
    const endInputElement = document.createElement("input");
    endInputElement.value = "18";

    terminalSearchService.updateBeginBufferLine({ target: beginInputElement } as unknown as Event);
    terminalSearchService.updateEndBufferLine({ target: endInputElement } as unknown as Event);

    expect(terminalSearchService.beginBufferLine()).toBe(5);
    expect(terminalSearchService.endBufferLine()).toBe(18);
  });
});
