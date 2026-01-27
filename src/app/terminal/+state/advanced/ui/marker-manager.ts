import { Terminal, IDecoration } from '@xterm/xterm';
import { TerminalStateManager } from '../../state';
import { IDisposable } from '../../../../common/models/models';
import {PromptSegment} from "../../../../config/+models/prompt-config";
import {PromptMarkerRenderer} from "./prompt-renderer";


type LineIndex = number;

export class MarkerManager implements IDisposable {
    private _decorations: Map<LineIndex, IDecoration> = new Map();
    private _terminal?: Terminal;
    private _renderer?: PromptMarkerRenderer;

    constructor(private sessionState: TerminalStateManager, promptSegments: PromptSegment[]) {
        this._renderer = new PromptMarkerRenderer(sessionState, promptSegments);
    }

    setTerminal(terminal: Terminal) {
        this._terminal = terminal;
    }

    disposeMarkers(){
        for (const [lineIndex, decoration] of this._decorations.entries()) {
            if (!decoration.isDisposed) {
                decoration.dispose();
            }
        }
    }

    refreshMarkers() {
        if (!this._terminal) return;

        const buffer = this._terminal.buffer.active;
        const viewportStart = buffer.viewportY;
        const viewportEnd = viewportStart + this._terminal.rows - 1; // inclusive

        // Sichtbarkeit der Commands strikt auf den aktuellen Viewport setzen
        this.updateViewportVisibility(viewportStart, viewportEnd);

        // Wir scannen den aktuellen Viewport + einen größeren Puffer um Flackern zu vermeiden
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

        // Disposed Decorations entfernen
        for (const [lineIndex, decoration] of this._decorations.entries()) {
            if (decoration.isDisposed) {
                this._decorations.delete(lineIndex);
            }
        }

        // Neue Marker hinzufügen
        for (const lineIndex of currentMarkerLines) {
            if (!this._decorations.has(lineIndex)) {
                this.addMarker(lineIndex);
            }
        }

        // Alte Dekorationen entfernen, die nicht mehr im Scan-Bereich sind oder keine ^^# Zeile mehr sind
        for (const [lineIndex, decoration] of this._decorations.entries()) {
            if (!currentMarkerLines.has(lineIndex)) {
                decoration.dispose();
                this._decorations.delete(lineIndex);
            }
        }
    }

    private updateViewportVisibility(viewportStart: number, viewportEnd: number) {
        if (!this._terminal) return;
        const buffer = this._terminal.buffer.active;

        const visibleCommandIndices = new Set<number>();
        for (let i = viewportStart; i <= viewportEnd; i++) {
            const line = buffer.getLine(i);
            if (!line) continue;
            const text = line.translateToString();
            const match = text.match(/^\^\^#(\d+)/);
            if (!match) continue;
            const commandId = match[1];
            const idx = this.findCommandIndex(commandId);
            if (idx >= 0) visibleCommandIndices.add(idx);
        }

        const commands = this.sessionState.commands;
        for (let idx = 0; idx < commands.length; idx++) {
            commands[idx].isInViewport = visibleCommandIndices.has(idx);
        }
    }

    private addMarker(lineIndex: number) {
        if (!this._terminal) return;

        const line = this._terminal.buffer.active.getLine(lineIndex);
        if (!line) return;

        const lineText = line.translateToString();
        // Erwarte ^^#<ID> am Anfang der Zeile
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
            width: 1,
            anchor: 'left'
        });

        if (decoration) {
            decoration.onRender((element) => {
                this._renderer!.render(element, commandIndex);
            });
            decoration.onDispose(() => {
                marker.dispose();
            });
            this._decorations.set(lineIndex, decoration);
        }
    }

    private findCommandIndex(commandId: string | undefined): number {
        return this.sessionState.commands.findIndex(c => c.id === commandId);
    }

    dispose() {
        this._decorations.forEach(d => d.dispose());
        this._decorations.clear();
        this._terminal = undefined;
    }
}
