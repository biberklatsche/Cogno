import { Terminal, IDecoration, IMarker } from '@xterm/xterm';
import { IDisposable } from '../../../../common/models/models';
import {PromptSegment} from "../../../../config/+models/prompt-config";
import {PromptMarkerRenderer} from "./prompt-renderer";
import {TerminalStateManager} from "../../state";
import { ContextMenuOverlayService } from "../../../../menu/context-menu-overlay/context-menu-overlay.service";


export class MarkerManager implements IDisposable {
    private _decorations: Map<IMarker, IDecoration> = new Map();
    private _terminal?: Terminal;
    private _renderer?: PromptMarkerRenderer;

    constructor(
        private stateManager: TerminalStateManager,
        promptSegments: PromptSegment[],
        contextMenuOverlayService: ContextMenuOverlayService,
    ) {
        this._renderer = new PromptMarkerRenderer(stateManager, promptSegments, contextMenuOverlayService);
    }

    setTerminal(terminal: Terminal) {
        this._terminal = terminal;
    }

    disposeMarkers(){
        for (const [marker, decoration] of this._decorations.entries()) {
            if (!decoration.isDisposed) {
                decoration.dispose();
            }
        }
    }

    refreshMarkers() {
        if (!this._terminal) return;

        const buffer = this._terminal.buffer.active;
        const viewportStart = buffer.viewportY - 1;
        const viewportEnd = viewportStart + this._terminal.rows - 1; // inclusive

        // Strictly set visibility of commands to the current viewport
        this.updateViewportVisibility(viewportStart, viewportEnd);

        // We scan the current viewport + a larger buffer to avoid flickering
        const startScan = Math.max(0, viewportStart - 20);
        const endScan = Math.min(buffer.length - 1, viewportEnd + 20);

        const currentMarkerLines = new Set<number>();

        for (let i = startScan; i <= endScan; i++) {
            const line = buffer.getLine(i);
            if (line) {
                const lineText = line.translateToString();
                if (lineText.startsWith('^^#')) {
                    currentMarkerLines.add(i);
                }
            }
        }

        // Remove disposed decorations and markers
        for (const [marker, decoration] of this._decorations.entries()) {
            if (decoration.isDisposed) {
                this._decorations.delete(marker);
            }
        }

        // Add new markers
        for (const lineIndex of currentMarkerLines) {
            // Check if a marker already exists for this line
            const existingMarker = this.findMarkerForLine(lineIndex);
            if (!existingMarker) {
                this.addMarker(lineIndex);
            }
        }

        // Remove old decorations whose markers are no longer in the scan range
        for (const [marker, decoration] of this._decorations.entries()) {
            const markerLine = marker.line;
            if (markerLine < startScan || markerLine > endScan || !currentMarkerLines.has(markerLine)) {
                decoration.dispose();
                this._decorations.delete(marker);
            }
        }
    }

    private findMarkerForLine(lineIndex: number): IMarker | undefined {
        for (const marker of this._decorations.keys()) {
            if (marker.line === lineIndex) {
                return marker;
            }
        }
        return undefined;
    }

    private updateViewportVisibility(viewportStart: number, viewportEnd: number) {
        if (!this._terminal) return;
        const buffer = this._terminal.buffer.active;
        const visibleCommandIndices = new Set<number>();
        let isCommandOnFirstLine = false;
        for (let i = viewportStart; i <= viewportEnd; i++) {
            const line = buffer.getLine(i);
            if (!line) continue;
            const text = line.translateToString();
            const match = text.match(/^\^\^#(\d+)/);
            if (!match) continue;
            isCommandOnFirstLine = i === viewportStart;
            const commandId = match[1];
            const idx = this.findCommandIndex(commandId);
            if (idx >= 0) visibleCommandIndices.add(idx);
        }

        let firstCommandOutOfViewportIdx = -1;
        if(!isCommandOnFirstLine) {
            // Find the first command above the viewport
            for (let i = viewportStart - 1; i >= 0; i--) {
                const line = buffer.getLine(i);
                if (!line) continue;
                const text = line.translateToString();
                const match = text.match(/^\^\^#(\d+)/);
                if (!match) continue;
                const commandId = match[1];
                const idx = this.findCommandIndex(commandId);
                if (idx >= 0) {
                    firstCommandOutOfViewportIdx = idx;
                    break;
                }
            }
        }

        const commands = [...this.stateManager.commands];
        for (let idx = 0; idx < commands.length; idx++) {
            commands[idx].isInViewport = visibleCommandIndices.has(idx);
            commands[idx].isFirstCommandOutOfViewport = (idx === firstCommandOutOfViewportIdx);
        }
        this.stateManager.updateCommands(commands);
    }

    private addMarker(lineIndex: number) {
        if (!this._terminal) return;

        const line = this._terminal.buffer.active.getLine(lineIndex);
        if (!line) return;

        const lineText = line.translateToString();
        // Expect ^^#<ID> at the beginning of the line
        const match = lineText.match(/^\^\^#(\d+)/);
        const commandId = match ? match[1] : undefined;
        const commandIndex = this.findCommandIndex(commandId);

        const buffer = this._terminal.buffer.active;
        const cursorYAbsolute = buffer.baseY + buffer.cursorY;
        const cursorYOffset = lineIndex - cursorYAbsolute;
        const marker = this._terminal.registerMarker(cursorYOffset);
        if (!marker) return;

        const decoration = this._terminal.registerDecoration({
            marker,
            x: 0,
            width: this._terminal.cols,
            anchor: 'left'
        });

        if (decoration) {
            decoration.onRender((element) => {
                this._renderer!.render(element, {
                    commandIndex,
                    getCommandOutput: () => this.extractCommandOutput(lineIndex),
                });
            });
            decoration.onDispose(() => {
                marker.dispose();
            });
            this._decorations.set(marker, decoration);
        }
    }

    private findCommandIndex(commandId: string | undefined): number {
        return this.stateManager.commands.findIndex(c => c.id === commandId);
    }

    private extractCommandOutput(lineIndex: number): string {
        if (!this._terminal) {
            return "";
        }

        const nextMarkerLineIndex = this.findNextMarkerLineIndex(lineIndex);
        const outputLineTexts: string[] = [];
        for (let currentLineIndex = lineIndex + 1; currentLineIndex < nextMarkerLineIndex; currentLineIndex++) {
            const line = this._terminal.buffer.active.getLine(currentLineIndex);
            if (!line) {
                continue;
            }

            outputLineTexts.push(line.translateToString(false));
        }

        return outputLineTexts.join("\n").trimEnd();
    }

    private findNextMarkerLineIndex(lineIndex: number): number {
        if (!this._terminal) {
            return lineIndex + 1;
        }

        for (let currentLineIndex = lineIndex + 1; currentLineIndex < this._terminal.buffer.active.length; currentLineIndex++) {
            const line = this._terminal.buffer.active.getLine(currentLineIndex);
            if (!line) {
                continue;
            }

            if (line.translateToString().startsWith("^^#")) {
                return currentLineIndex;
            }
        }

        return this._terminal.buffer.active.length;
    }

    dispose() {
        this._decorations.forEach(d => d.dispose());
        this._decorations.clear();
        this._terminal = undefined;
    }
}
