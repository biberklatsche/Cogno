import { Terminal } from "@xterm/xterm";
import { CommandBlockMenuActions, CommandMenuBlockRange } from "./command-menu-items";
import { promptMarkerIdOf } from "./prompt-marker.registry";

export type CommandBlockDetails = {
  markerLineIndex: number;
  nextMarkerLineIndex: number;
  outputText: string;
  blockRange: CommandMenuBlockRange;
};

const EMPTY_BLOCK_RANGE: CommandMenuBlockRange = { beginBufferLine: 1, endBufferLine: 0 };

export class CommandBlockResolver {
  constructor(private readonly getTerminal: () => Terminal | undefined) {}

  /**
   * The command menu's block-bound actions for the marker line `markerLine`
   * yields when the menu is used - the block is resolved then, never up front.
   */
  menuActions(markerLine: () => number | undefined): CommandBlockMenuActions {
    const block = () => {
      const line = markerLine();
      return line === undefined ? undefined : this.resolveByMarkerLine(line);
    };
    return {
      getCommandOutput: () => block()?.outputText ?? "",
      getBlockRange: () => block()?.blockRange ?? EMPTY_BLOCK_RANGE,
      scrollToCommandTop: () => {
        const details = block();
        if (details) this.getTerminal()?.scrollToLine(details.markerLineIndex);
      },
      scrollToCommandBottom: () => {
        const details = block();
        if (!details) return;
        this.getTerminal()?.scrollToLine(
          Math.max(details.markerLineIndex, details.nextMarkerLineIndex - 1),
        );
      },
    };
  }

  /**
   * The buffer line carrying the prompt marker of `commandId`, found by its
   * text. Only for commands without an anchored marker, i.e. those replayed
   * from a restored scrollback; everything else is answered by the registry.
   */
  findMarkerLineByCommandId(commandId: string): number | undefined {
    const terminal = this.getTerminal();
    if (!terminal) return undefined;
    for (let lineIndex = 0; lineIndex < terminal.buffer.active.length; lineIndex++) {
      const line = terminal.buffer.active.getLine(lineIndex);
      if (line && promptMarkerIdOf(line.translateToString()) === commandId) return lineIndex;
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
    for (
      let currentLineIndex = markerLineIndex + 1;
      currentLineIndex < nextMarkerLineIndex;
      currentLineIndex++
    ) {
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
    for (
      let currentLineIndex = markerLineIndex + 1;
      currentLineIndex < terminal.buffer.active.length;
      currentLineIndex++
    ) {
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
