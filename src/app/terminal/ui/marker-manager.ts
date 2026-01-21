import { Terminal, IDecoration } from '@xterm/xterm';
import { SessionState, Command } from '../+state/session.state';
import { IDisposable } from '../../common/models/models';

export class MarkerManager implements IDisposable {
    private _decorations: Map<number, IDecoration> = new Map();
    private _terminal?: Terminal;

    constructor(private sessionState: SessionState) {}

    setTerminal(terminal: Terminal) {
        this._terminal = terminal;
    }

    refreshMarkers() {
        if (!this._terminal) return;

        const buffer = this._terminal.buffer.active;
        const viewportStart = buffer.viewportY;
        const viewportEnd = viewportStart + this._terminal.rows;

        // Wir scannen den aktuellen Viewport + einen größeren Puffer um Flackern zu vermeiden
        const startScan = Math.max(0, viewportStart - 20);
        const endScan = Math.min(buffer.length - 1, viewportEnd + 20);

        const currentMarkerLines = new Set<number>();

        for (let i = startScan; i <= endScan; i++) {
            const line = buffer.getLine(i);
            if (line) {
                const lineText = line.translateToString();
                if (lineText.startsWith('COGNO')) {
                    console.log('marker on line:', i);
                    currentMarkerLines.add(i);
                }
            }
        }

        // Neue Marker hinzufügen
        for (const lineIndex of currentMarkerLines) {
            if (!this._decorations.has(lineIndex)) {
                this.addMarker(lineIndex);
            }
        }

        // Alte Dekorationen entfernen, die nicht mehr im Scan-Bereich sind oder keine COGNO Zeile mehr sind
        for (const [lineIndex, decoration] of this._decorations.entries()) {
            if (!currentMarkerLines.has(lineIndex)) {
                decoration.dispose();
                this._decorations.delete(lineIndex);
            }
        }
    }

    private addMarker(lineIndex: number) {
        if (!this._terminal) return;

        const line = this._terminal.buffer.active.getLine(lineIndex);
        if (!line) return;

        const lineText = line.translateToString();
        // Erwarte COGNO<ID> am Anfang der Zeile
        const match = lineText.match(/^COGNO(\d+)/);
        const commandId = match ? match[1] : null;
        
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
                this.renderMarkerContent(element, commandId);
            });
            decoration.onDispose(() => {
                marker.dispose();
            });
            this._decorations.set(lineIndex, decoration);
        }
    }

    private renderMarkerContent(element: HTMLElement, commandId: string | null) {
        element.innerHTML = '';
        const markerEl = document.createElement('div');
        markerEl.classList.add('cogno-marker');

        const command = commandId ? this.sessionState.commands.find(c => c.id === commandId) : null;

        if (command) {
            markerEl.innerText = `COGNO${commandId}`;
            // Optional: Zeige mehr Daten aus Command im Title/Tooltip
            markerEl.title = `Command: ${command.command}\nDir: ${command.directory}\nExit Code: ${command.returnCode}`;
        } else {
            markerEl.classList.add('dot-only');
        }

        element.appendChild(markerEl);
    }

    dispose() {
        this._decorations.forEach(d => d.dispose());
        this._decorations.clear();
        this._terminal = undefined;
    }
}
