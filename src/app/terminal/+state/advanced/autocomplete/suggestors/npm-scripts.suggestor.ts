import { Fs } from "../../../../../_tauri/fs";
import { Logger } from "../../../../../_tauri/logger";
import { PathFactory } from "../../adapter/path.factory";
import { AutocompletePathUtil } from "../autocomplete-path.util";
import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";

export class NpmScriptsSuggestor implements TerminalAutocompleteSuggestor {
    readonly id = "npm-scripts";
    readonly inputPattern = /^\s*npm\s+.*$/;

    matches(context: QueryContext): boolean {
        return context.mode === "npm-script" && this.inputPattern.test(context.beforeCursor);
    }

    async suggest(context: QueryContext): Promise<AutocompleteSuggestion[]> {
        if (context.mode !== "npm-script") return [];
        const adapter = PathFactory.createAdapter(context.shellContext);
        const cwdNorm = AutocompletePathUtil.normalizeCwd(context.cwd, context.shellContext);
        const cwdBackend = adapter.render(cwdNorm, { purpose: "backend_fs" });
        if (!cwdBackend) return [];

        const sep = cwdBackend.includes("\\") ? "\\" : "/";
        const packageJsonCandidates = [
            cwdBackend.endsWith(sep) ? `${cwdBackend}package.json` : `${cwdBackend}${sep}package.json`,
            `${cwdBackend}${sep}package.json`,
        ];

        try {
            let packageJsonPath: string | undefined;
            for (const candidate of packageJsonCandidates) {
                if (await Fs.exists(candidate)) {
                    packageJsonPath = candidate;
                    break;
                }
            }
            if (!packageJsonPath) {
                return [];
            }

            const text = await Fs.readTextFile(packageJsonPath);
            const parsed = JSON.parse(text) as { scripts?: Record<string, string> };
            const scripts = parsed.scripts ?? {};
            const query = context.fragment.toLowerCase();

            return Object.keys(scripts)
                .filter(name => !query || name.toLowerCase().includes(query))
                .map(name => {
                    const starts = name.toLowerCase().startsWith(query);
                    const contains = name.toLowerCase().includes(query);
                    return {
                        label: name,
                        detail: "package.json script",
                        insertText: name,
                        score: (starts ? 90 : contains ? 30 : 0) + 35,
                        source: "npm-script",
                        kind: "script" as const,
                        replaceStart: context.replaceStart,
                        replaceEnd: context.replaceEnd,
                    };
                });
        } catch {
            Logger.error(`[NpmScriptsSuggestor] failed to read/parse package.json in cwd '${cwdBackend}'`);
            return [];
        }
    }
}
