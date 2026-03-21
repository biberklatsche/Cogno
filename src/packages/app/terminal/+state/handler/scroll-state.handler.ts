import { Terminal } from "@xterm/xterm";
import { IDisposable } from "../../../common/models/models";
import { TerminalStateManager } from "../state";
import { ITerminalHandler } from "./handler";

export class ScrollStateHandler implements ITerminalHandler {
    private terminal?: Terminal;
    private scrollDisposable?: IDisposable;

    constructor(private readonly terminalStateManager: TerminalStateManager) {}

    registerTerminal(terminal: Terminal): IDisposable {
        this.terminal = terminal;
        this.updateScrolledLinesFromBottom();
        this.scrollDisposable = terminal.onScroll(() => {
            this.updateScrolledLinesFromBottom();
        });
        return this;
    }

    dispose(): void {
        this.scrollDisposable?.dispose();
        this.scrollDisposable = undefined;
        this.terminal = undefined;
    }

    private updateScrolledLinesFromBottom(): void {
        const activeBuffer = this.terminal?.buffer.active;
        const terminal = this.terminal;
        if (!activeBuffer || !terminal) {
            this.terminalStateManager.setScrolledLinesFromBottom(0);
            return;
        }

        const lastVisibleBufferLine = activeBuffer.viewportY + terminal.rows;
        const scrolledLinesFromBottom = Math.max(0, activeBuffer.length - lastVisibleBufferLine);
        this.terminalStateManager.setScrolledLinesFromBottom(scrolledLinesFromBottom);
    }
}
