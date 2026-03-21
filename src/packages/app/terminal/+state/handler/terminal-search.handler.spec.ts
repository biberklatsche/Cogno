import { of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { ConfigService } from "../../../config/+state/config.service";
import { TerminalSearchHandler } from "./terminal-search.handler";

describe("TerminalSearchHandler", () => {
  let appBus: AppBus;
  let terminalSearchHandler: TerminalSearchHandler;
  let terminalMock: ReturnType<typeof TerminalMockFactory.createTerminal>;

  beforeEach(() => {
    appBus = new AppBus();
    vi.spyOn(appBus, "publish");
    terminalSearchHandler = new TerminalSearchHandler(
      appBus,
      "terminal-1",
      {
        config$: of({}),
      } as ConfigService,
    );
    terminalSearchHandler.registerSearchAddon({
      clearDecorations: vi.fn(),
      findNext: vi.fn(),
    } as never);
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

    expect(appBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      path: ["app", "terminal"],
      type: "TerminalSearchResult",
      payload: expect.objectContaining({
        terminalId: "terminal-1",
        lines: [
          expect.objectContaining({ lineNumber: 2 }),
          expect.objectContaining({ lineNumber: 3 }),
        ],
      }),
    }));
  });
});
