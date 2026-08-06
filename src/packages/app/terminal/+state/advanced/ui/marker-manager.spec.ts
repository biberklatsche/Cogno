import type { ContextMenuOverlayService } from "@cogno/core-ui";
import type { IMarker } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../../app-bus/app-bus";
import { TerminalStateManager } from "../../state";
import { MarkerManager } from "./marker-manager";
import { PromptMarker, PromptMarkerRegistry } from "./prompt-marker.registry";

function createRegistryMarker(commandId: string, line: number): PromptMarker {
  return {
    commandId,
    marker: { line, isDisposed: false, dispose: vi.fn(), onDispose: vi.fn() } as unknown as IMarker,
  };
}

describe("MarkerManager", () => {
  let markerManager: MarkerManager;
  let stateManager: TerminalStateManager;
  let mockTerminal: any;
  let contextMenuOverlayService: Pick<ContextMenuOverlayService, "openAtElement">;
  let mockBus: AppBus;
  let registryMarkers: PromptMarker[];
  let registryValidateRange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockBus = new AppBus();
    vi.spyOn(mockBus, "publish");
    stateManager = new TerminalStateManager(mockBus);
    stateManager.initialize("test-id", "Bash" as any);
    contextMenuOverlayService = {
      openAtElement: vi.fn(),
    };
    registryMarkers = [];
    const registry = {
      markers: registryMarkers,
      validateRange: vi.fn(),
    } as unknown as PromptMarkerRegistry;
    registryValidateRange = vi.mocked(registry.validateRange);
    markerManager = new MarkerManager(
      stateManager,
      [],
      contextMenuOverlayService,
      mockBus,
      registry,
    );
    mockTerminal = TerminalMockFactory.createTerminal();
    mockTerminal.registerDecoration = vi.fn().mockReturnValue({
      isDisposed: false,
      dispose: vi.fn(),
      onRender: vi.fn(),
      onDispose: vi.fn(),
    });
    mockTerminal.buffer.active.length = 100;
    mockTerminal.rows = 10;
    mockTerminal.buffer.active.viewportY = 0;
    vi.mocked(mockTerminal.buffer.active.getLine).mockReturnValue(
      TerminalMockFactory.createLine("^^#1"),
    );
    markerManager.setTerminal(mockTerminal);
  });

  it("should create decorations for registry markers inside the viewport window", () => {
    registryMarkers.push(createRegistryMarker("1", 0));

    markerManager.refreshMarkers();

    expect(mockTerminal.registerDecoration).toHaveBeenCalledWith(
      expect.objectContaining({ marker: registryMarkers[0].marker }),
    );
  });

  it("should not recreate existing decorations", () => {
    registryMarkers.push(createRegistryMarker("1", 0));

    markerManager.refreshMarkers();
    markerManager.refreshMarkers();

    expect(mockTerminal.registerDecoration).toHaveBeenCalledTimes(1);
  });

  it("should create decorations for multiple registry markers", () => {
    registryMarkers.push(createRegistryMarker("1", 5), createRegistryMarker("2", 7));

    markerManager.refreshMarkers();

    expect(mockTerminal.registerDecoration).toHaveBeenCalledTimes(2);
  });

  it("should not create decorations for markers far outside the viewport", () => {
    registryMarkers.push(createRegistryMarker("1", 90));

    markerManager.refreshMarkers();

    expect(mockTerminal.registerDecoration).not.toHaveBeenCalled();
  });

  it("should dispose decorations whose markers left the viewport window", () => {
    const decorationMock = {
      isDisposed: false,
      dispose: vi.fn(),
      onRender: vi.fn(),
      onDispose: vi.fn(),
    };
    mockTerminal.registerDecoration.mockReturnValue(decorationMock);
    const entry = createRegistryMarker("1", 0);
    registryMarkers.push(entry);

    markerManager.refreshMarkers();
    expect(decorationMock.dispose).not.toHaveBeenCalled();

    (entry.marker as { line: number }).line = 90;
    markerManager.refreshMarkers();

    expect(decorationMock.dispose).toHaveBeenCalled();
  });

  it("should keep decorations for markers still inside the scan window", () => {
    const decorationMock = {
      isDisposed: false,
      dispose: vi.fn(),
      onRender: vi.fn(),
      onDispose: vi.fn(),
    };
    mockTerminal.registerDecoration.mockReturnValue(decorationMock);
    registryMarkers.push(createRegistryMarker("1", 0));

    markerManager.refreshMarkers();

    // Scroll a bit, but line 0 is still in scan range (viewport 5-14, scan -16 to 34)
    mockTerminal.buffer.active.viewportY = 5;
    markerManager.refreshMarkers();

    expect(decorationMock.dispose).not.toHaveBeenCalled();
  });

  it("should validate registry markers against the scan window before rendering", () => {
    markerManager.refreshMarkers();

    // Viewport -1..8 (viewportY - 1 .. + rows - 1), window ±20, clamped to the buffer.
    expect(registryValidateRange).toHaveBeenCalledWith(0, 28);
  });

  it("should skip marker work and clear decorations in the alternate buffer", () => {
    const decorationMock = {
      isDisposed: false,
      dispose: vi.fn(),
      onRender: vi.fn(),
      onDispose: vi.fn(),
    };
    mockTerminal.registerDecoration.mockReturnValue(decorationMock);
    registryMarkers.push(createRegistryMarker("1", 0));
    markerManager.refreshMarkers();

    mockTerminal.buffer.active.type = "alternate";
    const updateCommandsSpy = vi.spyOn(stateManager, "updateCommands");
    markerManager.refreshMarkers();

    expect(decorationMock.dispose).toHaveBeenCalled();
    expect(updateCommandsSpy).not.toHaveBeenCalled();
  });

  it("should publish command visibility only when it changes", () => {
    stateManager.updateCommand({ id: "1", directory: "/", user: "u", machine: "m" });
    registryMarkers.push(createRegistryMarker("1", 2));
    const updateCommandsSpy = vi.spyOn(stateManager, "updateCommands");

    markerManager.refreshMarkers();
    markerManager.refreshMarkers();

    expect(updateCommandsSpy).toHaveBeenCalledTimes(1);
    expect(stateManager.commands[0].isInViewport).toBe(true);
  });

  it("should mark the last command above the viewport as first out of viewport", () => {
    stateManager.updateCommand({ id: "1", directory: "/", user: "u", machine: "m" });
    stateManager.updateCommand({ id: "2", directory: "/", user: "u", machine: "m" });
    registryMarkers.push(createRegistryMarker("1", 10), createRegistryMarker("2", 55));
    mockTerminal.buffer.active.viewportY = 50;

    markerManager.refreshMarkers();

    expect(stateManager.commands[0].isFirstCommandOutOfViewport).toBe(true);
    expect(stateManager.commands[0].isInViewport).toBe(false);
    expect(stateManager.commands[1].isInViewport).toBe(true);
  });
});
