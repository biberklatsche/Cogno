import { describe, expect, it } from "vitest";

import { TerminalState } from "../../state";
import { AutocompleteContextParser } from "./autocomplete-context.parser";

function baseState(input: string, cursorIndex: number): TerminalState {
    return {
        terminalId: "t1",
        shellContext: { shellType: "Bash", backendOs: "macos" } as any,
        cursorPosition: { viewport: { col: 1, row: 1 }, col: 1, row: 1, char: "" },
        mousePosition: { viewport: { col: 1, row: 1 }, col: 1, row: 1, char: "" },
        dimensions: { rows: 24, cols: 80, cellHeight: 18, cellWidth: 9, viewportWidth: 720, viewportHeight: 432 },
        isFocused: true,
        isCommandRunning: false,
        isInFullScreenMode: false,
        commandStartTime: undefined,
        input: { text: input, cursorIndex, maxCursorIndex: cursorIndex },
        cwd: "/Users/larswolfram/projects",
    };
}

describe("AutocompleteContextParser", () => {
    it("parses cd context only when input is 'cd '", () => {
        const cdNoSpace = AutocompleteContextParser.parse(baseState("cd", 2));
        expect(cdNoSpace?.mode).toBe("command");
        expect((cdNoSpace as any)?.query).toBe("cd");

        const ctx = AutocompleteContextParser.parse(baseState("cd ", 3));
        expect(ctx?.mode).toBe("cd");
        expect((ctx as any).fragment).toBe("");
    });

    it("parses npm script context for 'npm '", () => {
        const ctx = AutocompleteContextParser.parse(baseState("npm ", 4));
        expect(ctx?.mode).toBe("npm-script");
        expect((ctx as any).fragment).toBe("");
    });
});
