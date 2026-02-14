import {ITerminalHandler} from "../../handler/handler";
import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../../common/models/models";
import {TerminalStateManager} from "../../state";
import OscParser from "../osc/cogno-osc.parser";
import {MarkerManager} from "./marker-manager";
import {PromptSegment} from "../../../../config/+models/prompt-config";
import {debounceTime, Subject} from "rxjs";

export class CommandLineObserver implements ITerminalHandler {

    private _disposables: IDisposable[] = [];
    private _terminal?: Terminal;
    private _markerManager: MarkerManager;
    private _refreshMarkerSubject = new Subject<void>();
    private readonly KEYSTROKE_DEBOUNCE_MS = 100;

    constructor(private stateManager: TerminalStateManager, promptSegments: PromptSegment[]) {
        this._markerManager = new MarkerManager(stateManager, promptSegments);

        // Debounce marker refresh to improve performance with long outputs
        // 16ms = ~60fps, which batches rapid render events without noticeable lag
        this._refreshMarkerSubject
            .pipe(debounceTime(16))
            .subscribe(() => {
                this._markerManager.refreshMarkers();
            });
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this._markerManager.setTerminal(terminal);

        this._disposables.push(terminal.onCursorMove(() => {

            if (!terminal?.buffer?.active) return;
            if(this.stateManager.isCommandRunning) return;
            try {
                const buffer = terminal.buffer?.active;
                const startInputY = this.findLastCognoMarkerY() + 1;
                const cursorX = buffer.cursorX; // 0-based column in viewport
                const cursorYViewport = buffer.cursorY; // 0-based row in viewport
                const viewportY = buffer.viewportY; // top of viewport absolute 0-based
                const cursorYAbsolute = cursorYViewport + viewportY; // absolute row in buffer
                const promptHeight = cursorYAbsolute - startInputY;
                const cursorIndex = cursorX + terminal.cols * promptHeight;
                const input = this.stateManager.input;
                const maxCursorIndex =  cursorIndex > input.maxCursorIndex ? cursorIndex : input.maxCursorIndex;
                this.stateManager.updateInput({...input, cursorIndex: cursorIndex, maxCursorIndex: maxCursorIndex});
            } catch {
                console.log('error');
                // ignore errors and keep defaults
            }
        }));
        this._disposables.push(this._terminal.onRender(() => {
            this._refreshMarkerSubject.next();
        }));

        this._disposables.push(this._terminal.onScroll(() => {
            this._refreshMarkerSubject.next();
        }));

        this._disposables.push(this._terminal.onResize(() => {
            this._markerManager.disposeMarkers();
            this._markerManager.refreshMarkers();
        }));
        this._disposables.push(this._terminal.onWriteParsed(() => {
            if(this.stateManager.isCommandRunning) return;
            const text = this.readCurrentText();
            const input = this.stateManager.input;
            this.stateManager.updateInput({...input, text: text});
        }));
        this._disposables.push(this._terminal.onKey((event) => {
            if(event.key === '\r' || event.key === '\n') {
                this.stateManager.startCommand();
            }
        }));
        this._disposables.push(terminal.parser
            .registerOscHandler(733, (data: string) => {
                this.stateManager.endCommand();
                const kv = OscParser.parse(data);
                if(!kv) return true;
                kv['duration'] = this.stateManager.getCommandDuration()?.toString() ?? '';
                this.stateManager.updateCommand(kv);
                this.stateManager.updateCwd(kv['directory'] ?? '');
                return true;
            }));
        return this;
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._refreshMarkerSubject.complete();
        this._markerManager.dispose();
        this._terminal = undefined;
    }

    private findLastCognoMarkerY(): number {
        let lastPromptRow = -1;
        if(!this._terminal?.buffer?.active) return lastPromptRow;
        for (let i = this._terminal.buffer.active.length - 1; i >= 0; i--) {
            const line = this._terminal.buffer.active.getLine(i);
            if (line && line.translateToString().startsWith('^^#')) {
                lastPromptRow = i;
                break;
            }
        }
        return lastPromptRow;
    }

    private readCurrentText(): string {
        const buffer = this._terminal?.buffer?.active;
        if(!buffer) return '';
        const lastCognoMarkerY = this.findLastCognoMarkerY();
        const input = this.stateManager.input;
        const heightOfPrompt = Math.ceil(input.maxCursorIndex / this._terminal!.cols);
        let text = ''
        for (let i = lastCognoMarkerY + 1; i <= lastCognoMarkerY + heightOfPrompt; i++) {
            const line = buffer.getLine(i);
            if (!line) continue;
            text += line.translateToString(false);
        }
        if(text.length > input.maxCursorIndex) {
            text = text.substring(0, input.maxCursorIndex);
        }
        return text.trimEnd();
    }

}
