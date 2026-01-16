import {ITerminalHandler} from "../handler/handler";
import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {AppBus} from "../../../app-bus/app-bus";
import {SessionState} from "../session.state";

export class InputObserver implements ITerminalHandler {

    private _parsedListener?: IDisposable;
    private _keyListener?: IDisposable;
    private _terminal?: Terminal;

    constructor(private bus: AppBus, private sessionState: SessionState) {

    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this._parsedListener = this._terminal.onWriteParsed(() => {
            if(this.sessionState.isCommandRunning) return;
            const lastPromptLineIndex = this.findLastPromptLineIndex();
            const input = this.readCurrentInput(lastPromptLineIndex + 1);
            console.log('last prompt: ' + input);
        });
        this._keyListener = this._terminal.onKey((event) => {
            if(event.key === '\r' || event.key === '\n') {
                this.sessionState.isCommandRunning = true;
            }
            console.log('key pressed: ' + JSON.stringify(event));
        });
        return this;
    }

    dispose(): void {
        if(!this._parsedListener) return;
        this._parsedListener.dispose();
        this._parsedListener=undefined;
        this._terminal=undefined;
    }

    private findLastPromptLineIndex(): number {
        let lastPromptLineIndex = -1;
        if(!this._terminal) return lastPromptLineIndex;
        if(!this._terminal.buffer.active) return lastPromptLineIndex;
        for (let i = this._terminal.buffer.active.length - 1; i >= 0; i--) {
            const line = this._terminal.buffer.active.getLine(i);
            if (line && line.translateToString().startsWith('COGNO')) {
                lastPromptLineIndex = i;
                break;
            }
        }
        return lastPromptLineIndex;
    }

    private readCurrentInput(index: number): string {
        let input = '';
        const buffer = this._terminal?.buffer?.active;
        if(!buffer) return input;
        if(index >= buffer.length) return input;
        const cursorX = this.sessionState.cursorPosition.viewport.col - 1;
        const cursorY = this.sessionState.cursorPosition.viewport.row - 1;
        for (let i = index; i <= cursorY; i++) {
            const line = buffer.getLine(i);
            if (!line) return input;
            if(i === cursorY) {
                input += line.translateToString(true, 0, cursorX);
            } else {
                input += line.translateToString(true);
            }
        }
        return input;
    }

}
