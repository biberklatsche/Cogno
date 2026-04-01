import { Terminal } from "@xterm/xterm";
import { ITerminalHandler } from "./handler";
import { IDisposable } from "../../../common/models/models";
import { TerminalStateManager } from "../state";
import { Opener } from "@cogno/app-tauri/opener";
import { TerminalPathResolver } from "../advanced/path/terminal-path.resolver";

type LinkMatch = {
    text: string;
    startIndex: number;
    endIndexExclusive: number;
    kind: "url" | "path";
};

export class LinkHandler implements ITerminalHandler {
    private _terminal?: Terminal;
    private _linkProviderDisposable?: IDisposable;
    private readonly _hoverHint = "Ctrl + Click to open";

    constructor(
        private readonly _stateManager: TerminalStateManager,
        private readonly _pathResolver: TerminalPathResolver = new TerminalPathResolver()
    ) {}

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this._linkProviderDisposable = terminal.registerLinkProvider({
            provideLinks: (bufferLineNumber, callback) => {
                const lineText = this.readBufferLineText(bufferLineNumber);
                if (!lineText) {
                    callback(undefined);
                    return;
                }
                const matches = this.extractMatches(lineText);
                if (matches.length === 0) {
                    callback(undefined);
                    return;
                }
                callback(matches.map(match => ({
                    range: {
                        start: { x: match.startIndex + 1, y: bufferLineNumber },
                        end: { x: match.endIndexExclusive, y: bufferLineNumber }
                    },
                    text: match.text,
                    decorations: { underline: true, pointerCursor: true },
                    hover: () => {
                        this._terminal?.element?.setAttribute("title", this._hoverHint);
                    },
                    leave: () => {
                        this._terminal?.element?.removeAttribute("title");
                    },
                    activate: (event: MouseEvent, text: string) => {
                        if (!event.ctrlKey) return;
                        event.preventDefault();
                        if (match.kind === "url") {
                            void Opener.openUrl(text);
                            return;
                        }
                        const backendPath = this._pathResolver.resolvePathForOpen(
                            text,
                            this._stateManager.state.cwd,
                            this._stateManager.pathAdapter
                        );
                        if (!backendPath) return;
                        void Opener.openPath(backendPath);
                    }
                })));
            }
        });
        return this;
    }

    dispose(): void {
        this._linkProviderDisposable?.dispose();
        this._linkProviderDisposable = undefined;
        this._terminal?.element?.removeAttribute("title");
        this._terminal = undefined;
    }

    private readBufferLineText(bufferLineNumber: number): string {
        const line = this._terminal?.buffer.active.getLine(bufferLineNumber - 1);
        return line?.translateToString(true) ?? "";
    }

    private extractMatches(lineText: string): LinkMatch[] {
        const matches: LinkMatch[] = [];
        const urlPattern = /\bhttps?:\/\/[^\s<>"'`]+/gi;
        for (const candidate of this.collect(urlPattern, lineText, "url")) {
            matches.push(candidate);
        }

        const pathPattern = /(?:[A-Za-z]:(?:\\|\/)[^\s<>"'`]+|(?:\\\\|\/\/)[^\s<>"'`]+|\/[^\s<>"'`]+|(?:\.\.?(?:\\|\/))[^\s<>"'`]+|(?:[^\/\\\s<>"'`:\(\)\[\]\{\},;=]+(?:[\\/][^\s<>"'`:\(\)\[\]\{\},;=]+)+))/g;
        for (const candidate of this.collect(pathPattern, lineText, "path")) {
            if (matches.some(existing => this.overlaps(existing, candidate))) continue;
            if (!this._pathResolver.resolvePathForOpen(candidate.text, this._stateManager.state.cwd, this._stateManager.pathAdapter)) continue;
            matches.push(candidate);
        }

        return matches.sort((a, b) => a.startIndex - b.startIndex);
    }

    private collect(pattern: RegExp, lineText: string, kind: "url" | "path"): LinkMatch[] {
        const out: LinkMatch[] = [];
        for (const raw of lineText.matchAll(pattern)) {
            const token = raw[0];
            const start = raw.index ?? -1;
            if (start < 0) continue;
            const cleaned = this.trimToken(token);
            if (!cleaned.text) continue;
            out.push({
                kind,
                text: cleaned.text,
                startIndex: start + cleaned.leadingTrim,
                endIndexExclusive: start + token.length - cleaned.trailingTrim
            });
        }
        return out;
    }

    private trimToken(token: string): { text: string; leadingTrim: number; trailingTrim: number } {
        let start = 0;
        let end = token.length;
        while (start < end && /['"`(\[]/.test(token[start])) start++;
        while (end > start && /[.,;:!?'"`\])]/.test(token[end - 1])) end--;
        return {
            text: token.slice(start, end),
            leadingTrim: start,
            trailingTrim: token.length - end
        };
    }

    private overlaps(a: LinkMatch, b: LinkMatch): boolean {
        return a.startIndex < b.endIndexExclusive && b.startIndex < a.endIndexExclusive;
    }
}


