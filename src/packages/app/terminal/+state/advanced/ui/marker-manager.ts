import { IDisposable } from "@cogno/core-support";
import { ContextMenuOverlayService } from "@cogno/core-ui";
import { IDecoration, IMarker, Terminal } from "@xterm/xterm";
import { AppBus } from "../../../../app-bus/app-bus";
import { PromptSegment } from "../../../../config/+models/prompt-config";
import { TerminalStateManager } from "../../state";
import { CommandBlockResolver } from "./command-block-resolver";
import { PromptMarkerRegistry } from "./prompt-marker.registry";
import { PromptMarkerRenderer } from "./prompt-renderer";

type MarkerManagerContextMenuOverlayPort = Pick<ContextMenuOverlayService, "openAtElement">;

/** Extra lines around the viewport that keep their decorations alive. */
const DECORATION_WINDOW_LINES = 20;

export class MarkerManager implements IDisposable {
  private _decorations: Map<IMarker, IDecoration> = new Map();
  private _terminal?: Terminal;
  private _renderer?: PromptMarkerRenderer;
  private readonly commandBlockResolver: CommandBlockResolver;
  private _lastVisibilitySignature?: string;
  private _decorationsClearedForAltBuffer = false;

  constructor(
    private stateManager: TerminalStateManager,
    promptSegments: PromptSegment[],
    contextMenuOverlayService: MarkerManagerContextMenuOverlayPort,
    appBus: AppBus,
    private readonly markerRegistry: PromptMarkerRegistry,
  ) {
    this._renderer = new PromptMarkerRenderer(
      stateManager,
      promptSegments,
      contextMenuOverlayService,
      appBus,
    );
    this.commandBlockResolver = new CommandBlockResolver(() => this._terminal);
  }

  setTerminal(terminal: Terminal) {
    this._terminal = terminal;
  }

  disposeMarkers() {
    for (const [marker, decoration] of this._decorations.entries()) {
      if (!decoration.isDisposed) {
        decoration.dispose();
      }
      this._decorations.delete(marker);
    }
    this._lastVisibilitySignature = undefined;
  }

  refreshMarkers() {
    if (!this._terminal) return;

    const buffer = this._terminal.buffer.active;
    if (buffer.type === "alternate") {
      // Fullscreen apps own the whole screen — prompt decorations must not
      // shine through, and there is nothing to scan or publish per frame.
      if (!this._decorationsClearedForAltBuffer) {
        this.disposeMarkers();
        this._decorationsClearedForAltBuffer = true;
      }
      return;
    }
    this._decorationsClearedForAltBuffer = false;

    const viewportStart = buffer.viewportY - 1;
    const viewportEnd = viewportStart + this._terminal.rows - 1;

    this.updateViewportVisibility(viewportStart, viewportEnd);

    const startScan = Math.max(0, viewportStart - DECORATION_WINDOW_LINES);
    const endScan = Math.min(buffer.length - 1, viewportEnd + DECORATION_WINDOW_LINES);

    const markersInWindow = new Set<IMarker>();
    for (const { marker, commandId } of this.markerRegistry.markers) {
      if (marker.line < startScan || marker.line > endScan) continue;
      markersInWindow.add(marker);
      if (!this._decorations.has(marker)) {
        this.addDecoration(marker, commandId);
      }
    }

    for (const [marker, decoration] of this._decorations.entries()) {
      if (decoration.isDisposed || marker.isDisposed || !markersInWindow.has(marker)) {
        decoration.dispose();
        this._decorations.delete(marker);
      }
    }
  }

  private updateViewportVisibility(viewportStart: number, viewportEnd: number) {
    const commands = this.stateManager.commands;
    const commandIndexById = new Map<string | undefined, number>();
    for (let idx = 0; idx < commands.length; idx++) {
      commandIndexById.set(commands[idx].id, idx);
    }

    const visibleCommandIndices = new Set<number>();
    let isCommandOnFirstLine = false;
    let lastCommandAboveViewportIdx = -1;
    for (const { marker, commandId } of this.markerRegistry.markers) {
      const line = marker.line;
      const idx = commandIndexById.get(commandId) ?? -1;
      if (line < viewportStart) {
        if (idx >= 0) lastCommandAboveViewportIdx = idx;
        continue;
      }
      if (line > viewportEnd) continue;
      if (line === viewportStart) isCommandOnFirstLine = true;
      if (idx >= 0) visibleCommandIndices.add(idx);
    }

    const firstCommandOutOfViewportIdx = isCommandOnFirstLine ? -1 : lastCommandAboveViewportIdx;

    // Publishing runs at render frequency — skip when nothing changed, so
    // subscribers (header, system info) only re-run on actual transitions.
    const signature = `${[...visibleCommandIndices].sort((a, b) => a - b).join(",")}|${firstCommandOutOfViewportIdx}|${commands.length}`;
    if (signature === this._lastVisibilitySignature) return;
    this._lastVisibilitySignature = signature;

    const nextCommands = [...commands];
    for (let idx = 0; idx < nextCommands.length; idx++) {
      nextCommands[idx].isInViewport = visibleCommandIndices.has(idx);
      nextCommands[idx].isFirstCommandOutOfViewport = idx === firstCommandOutOfViewportIdx;
    }
    this.stateManager.updateCommands(nextCommands);
  }

  private addDecoration(marker: IMarker, commandId: string) {
    if (!this._terminal) return;

    const lineText =
      this._terminal.buffer.active.getLine(marker.line)?.translateToString() ?? `^^#${commandId}`;
    const commandIndex = this.stateManager.commands.findIndex((c) => c.id === commandId);

    const decoration = this._terminal.registerDecoration({
      marker,
      x: 0,
      width: this._terminal.cols,
      anchor: "left",
    });
    if (!decoration) return;

    decoration.onRender((element) => {
      this._renderer?.render(element, {
        commandIndex,
        markerText: lineText,
        getCommandOutput: () =>
          this.commandBlockResolver.resolveByMarkerLine(marker.line)?.outputText ?? "",
        getBlockRange: () =>
          this.commandBlockResolver.resolveByMarkerLine(marker.line)?.blockRange ?? {
            beginBufferLine: 1,
            endBufferLine: 0,
          },
        scrollToCommandTop: () => {
          this._terminal?.scrollToLine(marker.line);
        },
        scrollToCommandBottom: () => {
          const commandBlockDetails = this.commandBlockResolver.resolveByMarkerLine(marker.line);
          const targetLineIndex = commandBlockDetails
            ? Math.max(marker.line, commandBlockDetails.nextMarkerLineIndex - 1)
            : marker.line;
          this._terminal?.scrollToLine(targetLineIndex);
        },
      });
    });
    this._decorations.set(marker, decoration);
  }

  dispose() {
    this._decorations.forEach((d) => {
      d.dispose();
    });
    this._decorations.clear();
    this._terminal = undefined;
  }
}
