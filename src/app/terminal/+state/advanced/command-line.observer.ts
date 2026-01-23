import {ITerminalHandler} from "../handler/handler";
import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {AppBus} from "../../../app-bus/app-bus";
import {Command, Position, SessionState} from "../session.state";
import OscParser from "./cogno-osc.parser";
import {MarkerManager} from "./ui/marker-manager";
import {Config} from "../../../config/+models/config";
import {PromptConfig, PromptProfile, PromptSegment} from "../../../config/+models/prompt-config";

export class CommandLineObserver implements ITerminalHandler {

    private _disposables: IDisposable[] = [];
    private _terminal?: Terminal;
    private _markerManager: MarkerManager;

    constructor(private sessionState: SessionState, promptSegments: PromptSegment[]) {
        this._markerManager = new MarkerManager(sessionState, promptSegments);
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this._markerManager.setTerminal(terminal);

        this._disposables.push(terminal.onCursorMove(() => {
            if (!terminal?.buffer?.active) return;
            try {
                const buffer = terminal.buffer?.active;
                const startInputY = this.findLastCognoMarkerY() + 1;
                const cursorX = buffer.cursorX; // 0-based column in viewport
                const cursorYViewport = buffer.cursorY; // 0-based row in viewport
                const viewportY = buffer.viewportY; // top of viewport absolute 0-based
                const cursorYAbsolute = cursorYViewport + viewportY; // absolute row in buffer
                const promptHeight = cursorYAbsolute - startInputY;
                const cursorIndex = cursorX + terminal.cols * promptHeight;
                const maxCursorIndex =  cursorIndex > this.sessionState.input.maxCursorIndex ? cursorIndex : this.sessionState.input.maxCursorIndex;
                this.sessionState.input = {...this.sessionState.input, cursorIndex: cursorIndex, maxCursorIndex: maxCursorIndex};
            } catch {
                console.log('error');
                // ignore errors and keep defaults
            }
        }));
        this._disposables.push(this._terminal.onWriteParsed(() => {
            if(this.sessionState.isCommandRunning) return;
            const text = this.readCurrentText();
            this.sessionState.input = {...this.sessionState.input, text: text};
        }));
        this._disposables.push(this._terminal.onKey((event) => {
            if(event.key === '\r' || event.key === '\n') {
                this.sessionState.isCommandRunning = true;
            }
        }));

        this._disposables.push(this._terminal.onRender(() => {
            this._markerManager.refreshMarkers();
        }));

        this._disposables.push(this._terminal.onScroll(() => {
            this._markerManager.refreshMarkers();
        }));

        this._disposables.push(this._terminal.onResize(() => {
            this._markerManager.disposeMarkers();
            this._markerManager.refreshMarkers();
        }));

        this._disposables.push(terminal.parser
            .registerOscHandler(733, (data: string) => {
                this.sessionState.isCommandRunning = false;
                const kv = OscParser.parse(data);
                if(!kv) return true;
                const command = new Command(kv);
                this.sessionState.addCommand(command);
                return true;
            }));
        return this;
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
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
        const heightOfPrompt = Math.ceil(this.sessionState.input.maxCursorIndex / this._terminal!.cols);
        let text = ''
        for (let i = lastCognoMarkerY + 1; i <= lastCognoMarkerY + heightOfPrompt; i++) {
            const line = buffer.getLine(i);
            if (!line) continue;
            text += line.translateToString(false);
        }
        if(text.length > this.sessionState.input.maxCursorIndex) {
            text = text.substring(0, this.sessionState.input.maxCursorIndex);
        }
        return text.trimEnd();
    }

}
