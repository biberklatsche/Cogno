import { ShellContextContract } from "@cogno/core-sdk";
import { PathFactory } from "./path.factory";

export class AutocompletePathUtil {
    private static readonly PARENT_TRAVERSAL_PREFIX_RE = /^(?:\.\.\/){2,}/;
    private static readonly POSIX_AUTOCOMPLETE_ESCAPE_RE = /([\\\s"'$`!*?|&;<>(){}\[\]])/g;
    private static readonly POWERSHELL_AUTOCOMPLETE_ESCAPE_RE = /([`\s"'$])/g;

    static normalizeCwd(cwd: string, shellContext: ShellContextContract): string {
        const adapter = PathFactory.createAdapter(shellContext);
        if (!cwd) return "/";
        try {
            return adapter.normalize(cwd);
        } catch {
            return "/";
        }
    }

    static toRelativePath(targetNorm: string, cwdNorm: string): string {
        const target = this.cleanPath(targetNorm);
        const cwd = this.cleanPath(cwdNorm);

        const targetSeg = target.split("/").filter(Boolean);
        const cwdSeg = cwd.split("/").filter(Boolean);

        const targetRoot = target.startsWith("//") ? `${targetSeg[0] ?? ""}/${targetSeg[1] ?? ""}` : targetSeg[0] ?? "";
        const cwdRoot = cwd.startsWith("//") ? `${cwdSeg[0] ?? ""}/${cwdSeg[1] ?? ""}` : cwdSeg[0] ?? "";

        if (targetRoot !== cwdRoot && (target.startsWith("//") || cwd.startsWith("//") || this.isDrivePath(target) || this.isDrivePath(cwd))) {
            return target;
        }

        let i = 0;
        while (i < targetSeg.length && i < cwdSeg.length && targetSeg[i] === cwdSeg[i]) {
            i++;
        }

        const up = new Array(Math.max(0, cwdSeg.length - i)).fill("..");
        const down = targetSeg.slice(i);
        const rel = [...up, ...down].join("/");

        return rel || ".";
    }

    static isParentTraversalOnly(path: string): boolean {
        if (!path) return false;
        if (path === ".") return true;
        const segments = path.split("/").filter(Boolean);
        return segments.length > 0 && segments.every(s => s === "..");
    }

    static toDisplayPath(targetNorm: string, cwdNorm: string, shellContext: ShellContextContract): string {
        const adapter = PathFactory.createAdapter(shellContext);
        const relative = this.toRelativePath(targetNorm, cwdNorm);
        const absolute = adapter.render(targetNorm, { purpose: "display" }) ?? targetNorm;

        const candidates: string[] = [];
        if (!this.isParentTraversalOnly(relative)) {
            candidates.push(relative);
        }
        candidates.push(absolute);

        return candidates.reduce((best, cur) => (cur.length < best.length ? cur : best), candidates[0]);
    }

    static appendDirectorySeparator(path: string, shellContext: ShellContextContract): string {
        if (!path) return path;
        const shellPath = this.toShellDisplayPath(path, shellContext);
        if (shellPath.endsWith("/") || shellPath.endsWith("\\")) return shellPath;
        return `${shellPath}${shellContext.shellType === "PowerShell" ? "\\" : "/"}`;
    }

    static shortenParentTraversalDisplay(path: string, shellContext: ShellContextContract): string {
        if (!path) return path;
        const separator = shellContext.shellType === "PowerShell" ? "\\" : "/";
        return path.replace(this.PARENT_TRAVERSAL_PREFIX_RE, `...${separator}`);
    }

    static escapePathForAutocompleteInsert(path: string, shellContext: ShellContextContract): string {
        if (!path) return path;
        if (shellContext.shellType === "PowerShell") {
            return path.replace(this.POWERSHELL_AUTOCOMPLETE_ESCAPE_RE, "`$1");
        }
        return path.replace(this.POSIX_AUTOCOMPLETE_ESCAPE_RE, "\\$1");
    }

    static unescapeAutocompletePathFragment(pathFragment: string, shellContext: ShellContextContract): string {
        if (!pathFragment) return pathFragment;
        if (shellContext.shellType === "PowerShell") {
            return pathFragment.replace(/`(.)/g, "$1");
        }
        return pathFragment.replace(/\\(.)/g, "$1");
    }

    static splitAutocompleteFragmentTokens(fragment: string, shellContext: ShellContextContract): string[] {
        if (!fragment) return [];

        const escapeCharacter = shellContext.shellType === "PowerShell" ? "`" : "\\";
        const tokens: string[] = [];
        let currentToken = "";
        let isEscaped = false;

        for (const currentCharacter of fragment.trim()) {
            if (isEscaped) {
                currentToken += currentCharacter;
                isEscaped = false;
                continue;
            }

            if (currentCharacter === escapeCharacter) {
                isEscaped = true;
                continue;
            }

            if (/\s/.test(currentCharacter)) {
                if (currentToken.length > 0) {
                    tokens.push(currentToken);
                    currentToken = "";
                }
                continue;
            }

            currentToken += currentCharacter;
        }

        if (isEscaped) {
            currentToken += escapeCharacter;
        }

        if (currentToken.length > 0) {
            tokens.push(currentToken);
        }

        return tokens;
    }

    private static isDrivePath(path: string): boolean {
        const parts = path.split("/").filter(Boolean);
        return parts.length > 0 && /^[a-z]$/i.test(parts[0]);
    }

    private static cleanPath(path: string): string {
        return path.replace(/\/+$/, "") || "/";
    }

    private static toShellDisplayPath(path: string, shellContext: ShellContextContract): string {
        if (shellContext.shellType !== "PowerShell") return path;
        return path.replace(/\//g, "\\");
    }
}
