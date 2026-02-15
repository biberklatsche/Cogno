import { Fs } from "../../../../../../_tauri/fs";
import { Path } from "../../../../../../_tauri/path";
import { PathFactory } from "../../../adapter/path.factory";
import { QueryContext } from "../../autocomplete.types";
import { isWslContext } from "../../../model/models";

export interface SpecCommandRanker {
    boostForCommand(command: string, context: QueryContext): Promise<number>;
}

type CacheEntry = {
    expiresAt: number;
    boost: number;
};

const TTL_MS = 5 * 60 * 1000;
const MAX_CACHE = 600;

export class BinaryAvailabilityRanker implements SpecCommandRanker {
    private readonly _cache = new Map<string, CacheEntry>();
    private _systemPathPromise?: Promise<string | null>;

    async boostForCommand(command: string, context: QueryContext): Promise<number> {
        const normalized = (command ?? "").trim();
        if (!normalized) return 0;

        const key = `${this.contextKey(context)}|${normalized}`;
        const now = Date.now();
        const cached = this._cache.get(key);
        if (cached && cached.expiresAt > now) {
            return cached.boost;
        }

        let boost = 0;
        try {
            boost = (await this.commandExists(normalized, context)) ? 26 : 0;
        } catch {
            boost = 0;
        }

        this.setCache(key, { expiresAt: now + TTL_MS, boost });
        return boost;
    }

    private async commandExists(command: string, context: QueryContext): Promise<boolean> {
        const candidateDirs = await this.resolveCandidateDirs(context);
        const fileNames = this.resolveCandidateFileNames(command, context);
        for (const dir of candidateDirs) {
            for (const fileName of fileNames) {
                const full = this.joinPath(dir, fileName);
                try {
                    if (await Fs.exists(full)) return true;
                } catch {
                    // Ignore inaccessible path segments.
                }
            }
        }
        return false;
    }

    private async resolveCandidateDirs(context: QueryContext): Promise<string[]> {
        const result: string[] = [];
        const add = (dir: string) => {
            const v = dir.trim();
            if (!v) return;
            if (!result.includes(v)) result.push(v);
        };

        const systemPath = await this.getSystemPathSafe();
        if (systemPath) {
            const delimiter = context.shellContext.backendOs === "windows" ? ";" : ":";
            systemPath.split(delimiter).forEach(add);
        }

        if (context.shellContext.backendOs === "windows") {
            if (isWslContext(context.shellContext)) {
                const adapter = PathFactory.createAdapter(context.shellContext);
                for (const linuxDir of ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]) {
                    try {
                        const norm = adapter.normalize(linuxDir);
                        const backend = adapter.render(norm, { purpose: "backend_fs" });
                        if (backend) add(backend);
                    } catch {
                        // ignore
                    }
                }
            } else {
                [
                    "C:\\Windows\\System32",
                    "C:\\Windows",
                    "C:\\Program Files\\Git\\usr\\bin",
                    "C:\\Program Files\\Git\\bin",
                    "C:\\Program Files\\nodejs",
                ].forEach(add);
            }
        } else {
            ["/usr/local/bin", "/usr/bin", "/bin", "/opt/homebrew/bin", "/usr/sbin", "/sbin"].forEach(add);
            try {
                const home = await Path.homeDir();
                if (home) add(this.joinPath(home, ".local/bin"));
            } catch {
                // ignore
            }
        }

        return result;
    }

    private resolveCandidateFileNames(command: string, context: QueryContext): string[] {
        const names = [command];
        if (context.shellContext.backendOs === "windows" && !isWslContext(context.shellContext)) {
            if (!/\.(exe|cmd|bat|com)$/i.test(command)) {
                names.push(`${command}.exe`, `${command}.cmd`, `${command}.bat`, `${command}.com`);
            }
        } else if (context.shellContext.shellType === "GitBash" && context.shellContext.backendOs === "windows") {
            if (!/\.exe$/i.test(command)) {
                names.push(`${command}.exe`);
            }
        }
        return names;
    }

    private joinPath(dir: string, file: string): string {
        const sep = dir.includes("\\") ? "\\" : "/";
        return dir.endsWith(sep) ? `${dir}${file}` : `${dir}${sep}${file}`;
    }

    private async getSystemPathSafe(): Promise<string | null> {
        if (!this._systemPathPromise) {
            this._systemPathPromise = Path.systemPath().catch(() => null);
        }
        return this._systemPathPromise;
    }

    private contextKey(context: QueryContext): string {
        const sc = context.shellContext;
        const wsl = isWslContext(sc) ? `|wsl=${sc.wslDistroName}` : "";
        return `${sc.backendOs}|${sc.shellType}${wsl}`;
    }

    private setCache(key: string, value: CacheEntry): void {
        if (this._cache.size >= MAX_CACHE) {
            const oldest = this._cache.keys().next().value;
            if (oldest) this._cache.delete(oldest);
        }
        this._cache.set(key, value);
    }
}

