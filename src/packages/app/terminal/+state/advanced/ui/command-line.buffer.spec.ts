import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../../__test__/mocks/terminal-mock.factory";
import { CommandLineBuffer } from "./command-line.buffer";
import { PromptMarkerRegistry } from "./prompt-marker.registry";

describe("CommandLineBuffer", () => {
  let buffer: CommandLineBuffer;
  let registry: PromptMarkerRegistry;
  let mockTerminal: any;

  function setLines(linesByIndex: Record<number, string>) {
    vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
      const text = linesByIndex[index];
      return text === undefined ? undefined : TerminalMockFactory.createLine(text);
    });
  }

  beforeEach(() => {
    registry = new PromptMarkerRegistry();
    buffer = new CommandLineBuffer(registry);
    mockTerminal = TerminalMockFactory.createTerminal();
    mockTerminal.buffer.active.length = 100;
    buffer.setTerminal(mockTerminal);
  });

  describe("inputStartLine", () => {
    it("returns marker line + 1 for an anchored marker", () => {
      mockTerminal.buffer.active.cursorY = 5;
      setLines({ 4: "^^#42", 5: "" });
      registry.expectMarker();
      registry.onWriteParsed();

      expect(buffer.inputStartLine()).toBe(5);
    });

    it("falls back to a capped text scan when nothing is anchored", () => {
      setLines({ 60: "^^#7" });

      expect(buffer.inputStartLine()).toBe(61);
    });
  });

  describe("cursorInputIndex", () => {
    it("maps the cursor cell to its input index across wrapped lines", () => {
      mockTerminal.cols = 10;
      mockTerminal.buffer.active.cursorY = 5;
      setLines({ 4: "^^#42", 5: "" });
      registry.expectMarker();
      registry.onWriteParsed();

      // Cursor on the second wrapped input row, column 3.
      mockTerminal.buffer.active.cursorY = 6;
      mockTerminal.buffer.active.cursorX = 3;

      expect(buffer.cursorInputIndex()).toBe(13);
    });

    it("returns -1 without a terminal", () => {
      const detached = new CommandLineBuffer(new PromptMarkerRegistry());
      expect(detached.cursorInputIndex()).toBe(-1);
    });
  });

  describe("readInputText", () => {
    it("reads text over wrapped lines below the marker and caps at maxCursorIndex", () => {
      mockTerminal.cols = 10;
      mockTerminal.buffer.active.cursorY = 5;
      setLines({ 4: "^^#42", 5: "hello worl", 6: "d example!" });
      registry.expectMarker();
      registry.onWriteParsed();

      expect(buffer.readInputText(19)).toBe("hello world example");
    });

    it("trims trailing whitespace", () => {
      mockTerminal.cols = 20;
      mockTerminal.buffer.active.cursorY = 5;
      setLines({ 4: "^^#42", 5: "hello   " });
      registry.expectMarker();
      registry.onWriteParsed();

      expect(buffer.readInputText(8)).toBe("hello");
    });

    it("returns an empty string when the terminal is not set", () => {
      const detached = new CommandLineBuffer(new PromptMarkerRegistry());
      expect(detached.readInputText(10)).toBe("");
    });
  });

  describe("selectedInputRange", () => {
    it("maps the active selection to input indices", () => {
      mockTerminal.cols = 10;
      mockTerminal.buffer.active.cursorY = 5;
      setLines({ 4: "^^#42", 5: "" });
      registry.expectMarker();
      registry.onWriteParsed();
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 2, y: 5 },
        end: { x: 6, y: 5 },
      });

      expect(buffer.selectedInputRange(19)).toEqual({ startIndex: 2, endIndex: 6 });
    });

    it("returns undefined without a selection", () => {
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue(undefined);

      expect(buffer.selectedInputRange(19)).toBeUndefined();
    });

    it("returns undefined when the range starts before the input", () => {
      mockTerminal.cols = 10;
      mockTerminal.buffer.active.cursorY = 5;
      setLines({ 4: "^^#42", 5: "" });
      registry.expectMarker();
      registry.onWriteParsed();
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 2, y: 4 },
        end: { x: 6, y: 5 },
      });

      expect(buffer.selectedInputRange(19)).toBeUndefined();
    });

    it("returns undefined when the range ends past maxCursorIndex", () => {
      mockTerminal.cols = 10;
      mockTerminal.buffer.active.cursorY = 5;
      setLines({ 4: "^^#42", 5: "" });
      registry.expectMarker();
      registry.onWriteParsed();
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 2, y: 5 },
        end: { x: 5, y: 6 },
      });

      expect(buffer.selectedInputRange(5)).toBeUndefined();
    });
  });

  describe("selectInputSpan", () => {
    it("selects the span at the input-relative row/column", () => {
      mockTerminal.cols = 10;
      mockTerminal.buffer.active.cursorY = 5;
      setLines({ 4: "^^#42", 5: "" });
      registry.expectMarker();
      registry.onWriteParsed();

      buffer.selectInputSpan(13, 4);

      expect(mockTerminal.select).toHaveBeenCalledWith(3, 6, 4);
    });
  });

  describe("selection passthroughs", () => {
    it("forwards hasSelection/getSelection/clearSelection to the terminal", () => {
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelection).mockReturnValue("^^#1\nfoo");

      expect(buffer.hasSelection()).toBe(true);
      expect(buffer.getSelection()).toBe("^^#1\nfoo");
      buffer.clearSelection();
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
    });
  });

  describe("sanitizeCopiedText", () => {
    it("strips ^^# marker lines", () => {
      expect(buffer.sanitizeCopiedText("^^#1\nfoo\nbar")).toBe("foo\nbar");
    });
  });
});
