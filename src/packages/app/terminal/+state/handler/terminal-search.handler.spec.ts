import { of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import type { ConfigService } from "../../../config/+state/config.service";
import { TerminalSearchHandler } from "./terminal-search.handler";

describe("TerminalSearchHandler", () => {
  let appBus: AppBus;
  let terminalSearchHandler: TerminalSearchHandler;
  let terminalMock: ReturnType<typeof TerminalMockFactory.createTerminal>;
  let searchAddonMock: {
    clearDecorations: ReturnType<typeof vi.fn>;
    findNext: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    appBus = new AppBus();
    vi.spyOn(appBus, "publish");
    searchAddonMock = {
      clearDecorations: vi.fn(),
      findNext: vi.fn(),
    };
    terminalSearchHandler = new TerminalSearchHandler(appBus, "terminal-1", {
      config$: of({
        search: {
          match: {
            background_color: "112233",
            border_color: "223344",
            overview_ruler_color: "334455",
          },
          active_match: {
            background_color: "445566",
            border_color: "556677",
            overview_ruler_color: "667788",
          },
        },
      }),
    } as ConfigService);
    terminalSearchHandler.registerSearchAddon(searchAddonMock as never);
    terminalMock = TerminalMockFactory.createTerminal();
    terminalSearchHandler.registerTerminal(terminalMock);
  });

  it("restricts search results to the requested buffer line range", () => {
    vi.mocked(terminalMock.buffer.active.getLine).mockImplementation((lineIndex: number) => {
      if (lineIndex === 0) return TerminalMockFactory.createLine("alpha");
      if (lineIndex === 1) return TerminalMockFactory.createLine("needle one");
      if (lineIndex === 2) return TerminalMockFactory.createLine("needle two");
      if (lineIndex === 3) return TerminalMockFactory.createLine("needle three");
      return null;
    });
    terminalMock.buffer.active.length = 4;

    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRequested",
      payload: {
        terminalId: "terminal-1",
        query: "needle",
        caseSensitive: false,
        regularExpression: false,
        beginBufferLine: 2,
        endBufferLine: 3,
      },
    });

    expect(appBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["app", "terminal"],
        type: "TerminalSearchResult",
        payload: expect.objectContaining({
          terminalId: "terminal-1",
          beginBufferLine: 2,
          endBufferLine: 3,
          hasMore: false,
          lines: [
            expect.objectContaining({ lineNumber: 2 }),
            expect.objectContaining({ lineNumber: 3 }),
          ],
        }),
      }),
    );
    expect(searchAddonMock.clearDecorations).toHaveBeenCalledTimes(1);
    expect(searchAddonMock.findNext).not.toHaveBeenCalled();
    expect(terminalMock.registerDecoration).toHaveBeenCalledTimes(2);
  });

  it("restores global addon highlights when no block filter is active", () => {
    vi.mocked(terminalMock.buffer.active.getLine).mockImplementation((lineIndex: number) => {
      if (lineIndex === 0) return TerminalMockFactory.createLine("needle one");
      if (lineIndex === 1) return TerminalMockFactory.createLine("needle two");
      return null;
    });
    terminalMock.buffer.active.length = 2;

    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRequested",
      payload: {
        terminalId: "terminal-1",
        query: "needle",
        caseSensitive: false,
        regularExpression: false,
      },
    });

    expect(searchAddonMock.findNext).toHaveBeenCalledTimes(1);
    expect(terminalMock.registerDecoration).not.toHaveBeenCalled();
  });

  it("reuses cached block line text across repeated searches in the same range", () => {
    const firstLine = TerminalMockFactory.createLine("needle one");
    const secondLine = TerminalMockFactory.createLine("needle two");

    vi.mocked(terminalMock.buffer.active.getLine).mockImplementation((lineIndex: number) => {
      if (lineIndex === 0) return firstLine;
      if (lineIndex === 1) return secondLine;
      return null;
    });
    terminalMock.buffer.active.length = 2;

    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRequested",
      payload: {
        terminalId: "terminal-1",
        query: "needle",
        caseSensitive: false,
        regularExpression: false,
        beginBufferLine: 1,
        endBufferLine: 2,
      },
    });

    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRequested",
      payload: {
        terminalId: "terminal-1",
        query: "one",
        caseSensitive: false,
        regularExpression: false,
        beginBufferLine: 1,
        endBufferLine: 2,
      },
    });

    expect(firstLine.translateToString).toHaveBeenCalledTimes(1);
    expect(secondLine.translateToString).toHaveBeenCalledTimes(1);
  });

  it("returns paged block search results with hasMore and next cursor", () => {
    vi.mocked(terminalMock.buffer.active.getLine).mockImplementation((lineIndex: number) => {
      if (lineIndex === 0) return TerminalMockFactory.createLine("needle one");
      if (lineIndex === 1) return TerminalMockFactory.createLine("needle two");
      if (lineIndex === 2) return TerminalMockFactory.createLine("needle three");
      return null;
    });
    terminalMock.buffer.active.length = 3;

    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRequested",
      payload: {
        terminalId: "terminal-1",
        query: "needle",
        caseSensitive: false,
        regularExpression: false,
        beginBufferLine: 1,
        endBufferLine: 3,
        resultLineLimit: 2,
      },
    });

    expect(appBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["app", "terminal"],
        type: "TerminalSearchResult",
        payload: expect.objectContaining({
          hasMore: true,
          nextCursorBufferLine: 3,
          lines: [
            expect.objectContaining({ lineNumber: 1 }),
            expect.objectContaining({ lineNumber: 2 }),
          ],
        }),
      }),
    );
  });

  it("keeps earlier block highlights when loading the next page", () => {
    vi.mocked(terminalMock.buffer.active.getLine).mockImplementation((lineIndex: number) => {
      if (lineIndex === 0) return TerminalMockFactory.createLine("needle one");
      if (lineIndex === 1) return TerminalMockFactory.createLine("needle two");
      if (lineIndex === 2) return TerminalMockFactory.createLine("needle three");
      return null;
    });
    terminalMock.buffer.active.length = 3;

    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRequested",
      payload: {
        terminalId: "terminal-1",
        query: "needle",
        caseSensitive: false,
        regularExpression: false,
        beginBufferLine: 1,
        endBufferLine: 3,
        resultLineLimit: 2,
      },
    });

    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRequested",
      payload: {
        terminalId: "terminal-1",
        query: "needle",
        caseSensitive: false,
        regularExpression: false,
        beginBufferLine: 1,
        endBufferLine: 3,
        cursorBufferLine: 3,
        resultLineLimit: 2,
      },
    });

    expect(terminalMock.registerDecoration).toHaveBeenCalledTimes(3);
  });
});
