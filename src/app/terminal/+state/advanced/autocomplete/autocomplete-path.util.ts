import { TerminalState } from "../../state";
import { PathFactory } from "../adapter/path.factory";

export class AutocompletePathUtil {
    static normalizeCwd(cwd: string, shellContext: TerminalState["shellContext"]): string {
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

    static toDisplayPath(targetNorm: string, cwdNorm: string, shellContext: TerminalState["shellContext"]): string {
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

    private static isDrivePath(path: string): boolean {
        const parts = path.split("/").filter(Boolean);
        return parts.length > 0 && /^[a-z]$/i.test(parts[0]);
    }

    private static cleanPath(path: string): string {
        return path.replace(/\/+$/, "") || "/";
    }
}
