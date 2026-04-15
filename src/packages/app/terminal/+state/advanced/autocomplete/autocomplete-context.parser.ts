import { TerminalState } from "../../state";
import { QueryContext } from "./autocomplete.types";

export class AutocompleteContextParser {
  static parse(state: TerminalState): QueryContext | undefined {
    const inputText = state.input.text;
    const cursorIndex = state.input.cursorIndex;
    // `input.text` may be trimmed by observers; preserve typed trailing spaces
    // by padding to the current cursor position.
    const paddedInputText = inputText.padEnd(cursorIndex, " ");
    const beforeCursor = paddedInputText.slice(0, cursorIndex);
    if (!beforeCursor.trim()) return undefined;

    const base = {
      beforeCursor,
      inputText,
      cursorIndex,
      cwd: state.cwd,
      shellContext: state.shellContext,
    };

    const cdWithSpace = beforeCursor.match(/^\s*cd\s+/);
    if (cdWithSpace) {
      return {
        ...base,
        mode: "cd",
        fragment: beforeCursor.slice(cdWithSpace[0].length),
        replaceStart: cdWithSpace[0].length,
        replaceEnd: cursorIndex,
      };
    }

    return {
      ...base,
      mode: "command",
      query: beforeCursor.trim(),
      replaceStart: 0,
      replaceEnd: cursorIndex,
    };
  }
}
