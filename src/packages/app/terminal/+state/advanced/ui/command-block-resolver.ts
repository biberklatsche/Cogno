import { Terminal } from "@xterm/xterm";
import { CommandMenuBlockRange } from "./command-menu-items";

export type CommandBlockDetails = {
    markerLineIndex: number;
    nextMarkerLineIndex: number;
    outputText: string;
    blockRange: CommandMenuBlockRange;
};

export class CommandBlockResolver {
    constructor(private readonly getTerminal: () => Terminal | undefined) {}

    resolveByCommandId(commandId: string): CommandBlockDetails | undefined {
        const terminal = this.getTerminal();
        if (!terminal) {
            return undefined;
        }

        for (let currentLineIndex = 0; currentLineIndex < terminal.buffer.active.length; currentLineIndex++) {
            const line = terminal.buffer.active.getLine(currentLineIndex);
            if (!line) {
                continue;
            }

            if (line.translateToString().startsWith(`^^#${commandId}`)) {
                return this.resolveByMarkerLine(currentLineIndex);
            }
        }

        return undefined;
    }

    resolveByMarkerLine(markerLineIndex: number): CommandBlockDetails | undefined {
        const terminal = this.getTerminal();
        if (!terminal) {
            return undefined;
        }

        const nextMarkerLineIndex = this.findNextMarkerLineIndex(markerLineIndex, terminal);
        const outputLineTexts: string[] = [];
        for (let currentLineIndex = markerLineIndex + 1; currentLineIndex < nextMarkerLineIndex; currentLineIndex++) {
            const line = terminal.buffer.active.getLine(currentLineIndex);
            if (!line) {
                continue;
            }

            outputLineTexts.push(line.translateToString(false));
        }

        return {
            markerLineIndex,
            nextMarkerLineIndex,
            outputText: outputLineTexts.join("\n").trimEnd(),
            blockRange: {
                beginBufferLine: markerLineIndex + 2,
                endBufferLine: nextMarkerLineIndex,
            },
        };
    }

    private findNextMarkerLineIndex(markerLineIndex: number, terminal: Terminal): number {
        for (let currentLineIndex = markerLineIndex + 1; currentLineIndex < terminal.buffer.active.length; currentLineIndex++) {
            const line = terminal.buffer.active.getLine(currentLineIndex);
            if (!line) {
                continue;
            }

            if (line.translateToString().startsWith("^^#")) {
                return currentLineIndex;
            }
        }

        return terminal.buffer.active.length;
    }
}


