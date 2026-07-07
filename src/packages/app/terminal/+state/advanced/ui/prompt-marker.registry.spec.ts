import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../../__test__/mocks/terminal-mock.factory";
import { PromptMarkerRegistry } from "./prompt-marker.registry";

describe("PromptMarkerRegistry", () => {
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
    mockTerminal = TerminalMockFactory.createTerminal();
    mockTerminal.buffer.active.length = 100;
    registry.setTerminal(mockTerminal);
  });

  it("should anchor a marker for a freshly printed ^^# line after expectMarker", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#42", 5: "" });

    registry.expectMarker();
    registry.onWriteParsed();

    // Offset relative to the cursor line (5): the marker line is 4.
    expect(mockTerminal.registerMarker).toHaveBeenCalledWith(-1);
    expect(registry.markers).toHaveLength(1);
    expect(registry.markers[0].commandId).toBe("42");
  });

  it("should not scan the buffer when no marker is expected", () => {
    registry.onWriteParsed();

    expect(mockTerminal.buffer.active.getLine).not.toHaveBeenCalled();
    expect(mockTerminal.registerMarker).not.toHaveBeenCalled();
  });

  it("should not anchor the same command id twice", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#42", 5: "" });

    registry.expectMarker();
    registry.onWriteParsed();
    registry.expectMarker();
    registry.onWriteParsed();

    expect(registry.markers).toHaveLength(1);
  });

  it("should anchor markers for consecutive prompts", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#1", 5: "" });
    registry.expectMarker();
    registry.onWriteParsed();

    mockTerminal.buffer.active.cursorY = 9;
    setLines({ 4: "^^#1", 8: "^^#2", 9: "" });
    registry.expectMarker();
    registry.onWriteParsed();

    expect(registry.markers).toHaveLength(2);
    expect(registry.markers.map((entry) => entry.commandId)).toEqual(["1", "2"]);
  });

  it("should return the last anchored marker line without scanning", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#42", 5: "" });
    registry.expectMarker();
    registry.onWriteParsed();
    vi.mocked(mockTerminal.buffer.active.getLine).mockClear();

    expect(registry.lastMarkerLine()).toBe(4);
    expect(mockTerminal.buffer.active.getLine).not.toHaveBeenCalled();
  });

  it("should anchor an expected marker eagerly when lastMarkerLine is read before onWriteParsed", () => {
    // Prompt 1 is anchored normally.
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#1", 5: "" });
    registry.expectMarker();
    registry.onWriteParsed();

    // Prompt 2's marker line is already in the buffer, but the chunk's
    // cursor-move events fire before onWriteParsed anchors it — a reader on
    // that path must not see prompt 1's line.
    mockTerminal.buffer.active.cursorY = 9;
    setLines({ 4: "^^#1", 8: "^^#2", 9: "" });
    registry.expectMarker();

    expect(registry.lastMarkerLine()).toBe(8);
    expect(registry.markers.map((entry) => entry.commandId)).toEqual(["1", "2"]);
  });

  it("should not rescan on onWriteParsed after an eager anchor succeeded", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#42", 5: "" });
    registry.expectMarker();
    registry.lastMarkerLine();
    vi.mocked(mockTerminal.buffer.active.getLine).mockClear();

    registry.onWriteParsed();

    expect(mockTerminal.buffer.active.getLine).not.toHaveBeenCalled();
  });

  it("should keep returning the previous marker while the expected line is not printed yet", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#1", 5: "" });
    registry.expectMarker();
    registry.onWriteParsed();

    // OSC 733 arrived, but the PS1 marker line is still in a later chunk.
    registry.expectMarker();

    expect(registry.lastMarkerLine()).toBe(4);
  });

  it("should fall back to a capped text scan when nothing is anchored", () => {
    setLines({ 60: "^^#7" });

    expect(registry.lastMarkerLine()).toBe(60);
  });

  it("should ignore markers disposed by scrollback trimming", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#42", 5: "" });
    registry.expectMarker();
    registry.onWriteParsed();

    const marker = registry.markers[0].marker as unknown as { isDisposed: boolean };
    marker.isDisposed = true;

    expect(registry.markers).toHaveLength(0);
  });

  it("should re-anchor a marker whose line no longer matches after resync", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#42", 5: "" });
    registry.expectMarker();
    registry.onWriteParsed();
    const staleMarker = registry.markers[0].marker as unknown as {
      line: number;
      dispose: ReturnType<typeof vi.fn>;
    };

    // Reflow shifted the marker text two lines down without xterm noticing.
    setLines({ 4: "some wrapped output", 6: "^^#42", 5: "" });
    registry.resync();

    expect(staleMarker.dispose).toHaveBeenCalled();
    expect(registry.markers).toHaveLength(1);
    expect(registry.markers[0].commandId).toBe("42");
    expect(registry.markers[0].marker.line).toBe(6);
  });

  it("should drop a marker whose line disappeared entirely after resync", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#42", 5: "" });
    registry.expectMarker();
    registry.onWriteParsed();

    setLines({});
    registry.resync();

    expect(registry.markers).toHaveLength(0);
  });

  it("should dispose all markers on dispose", () => {
    mockTerminal.buffer.active.cursorY = 5;
    setLines({ 4: "^^#42", 5: "" });
    registry.expectMarker();
    registry.onWriteParsed();
    const marker = registry.markers[0].marker as unknown as { dispose: ReturnType<typeof vi.fn> };

    registry.dispose();

    expect(marker.dispose).toHaveBeenCalled();
  });
});
