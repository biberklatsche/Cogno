import {IPathAdapter, RenderContext} from "./path-adapter.interface";
import {OS} from "../../../../../_tauri/os";
import {ShellContext} from "../../data/models";

export abstract class BasePathAdapter implements IPathAdapter {
    constructor(protected readonly ctx: ShellContext) {}

    normalize(input: string): string {
        const s = input.trim();
        if (!s) throw new Error("Empty path");

        // --- Windows drive: C:\x or C:/x or C:
        const mDrive = /^([A-Za-z]):(?:[\\/](.*))?$/.exec(s);
        if (mDrive) {
            const drive = mDrive[1].toLowerCase();
            const rest = (mDrive[2] ?? "").replace(/\\/g, "/");
            return this.normalizeCognoAbs(`/${drive}/${rest}`);
        }

        // --- UNC: \\server\share\... or //server/share/...
        const mUnc = /^(\\\\|\/\/)([^\\/]+)[\\/]+([^\\/]+)(?:[\\/]+(.*))?$/.exec(s);
        if (mUnc) {
            const server = mUnc[2];
            const share = mUnc[3];
            const rest = (mUnc[4] ?? "").replace(/\\/g, "/");
            return this.normalizeCognoAbs(`//unc/${server}/${share}/${rest}`);
        }

        // --- WSL mount: /mnt/c/...
        const mWslMount = /^\/mnt\/([A-Za-z])\/(.*)$/.exec(s);
        if (mWslMount) {
            const drive = mWslMount[1].toLowerCase();
            return this.normalizeCognoAbs(`/${drive}/${mWslMount[2] ?? ""}`);
        }

        // --- Absolute unix-like path
        if (s.startsWith("/")) {
            return this.normalizeUnixPath(s);
        }

        throw new Error(`Unrecognized absolute path: ${input}`);
    }

    protected normalizeUnixPath(s: string): string {
        return this.normalizeCognoAbs(s);
    }

    render(cognoPath: string, ctx: RenderContext): string | undefined {
        const p = this.normalizeCognoAbs(cognoPath);

        const backendOs = this.ctx.backendOs ?? OS.platform();
        const quoteMode = ctx.quoteMode ?? (ctx.purpose === "insert_arg" ? "if-needed" : "never");

        let raw: string | undefined = undefined;
        if (ctx.purpose === "backend_fs") {
            raw = backendOs === "windows" ? this.toWindowsBackendPath(p) : this.toPosixBackendPath(p);
        } else {
            raw = this.toShellView(p);
        }

        if (ctx.purpose === "insert_arg") {
            return this.quoteForShell(raw, quoteMode);
        }
        return raw;
    }

    protected toShellView(p?: string): string | undefined{
        return p;
    }

    protected toWindowsBackendPath(p: string): string | undefined {
        const mDrive = /^\/([a-z])\/(.*)$/.exec(p);
        if (mDrive) {
            const drive = mDrive[1].toUpperCase();
            const rest = (mDrive[2] ?? "").split("/").join("\\");
            return rest ? `${drive}:\\${rest}` : `${drive}:\\`;
        }

        const mUnc = /^\/\/unc\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(p);
        if (mUnc) {
            const server = mUnc[1];
            const share = mUnc[2];
            const rest = (mUnc[3] ?? "").split("/").join("\\");
            return rest ? `\\\\${server}\\${share}\\${rest}` : `\\\\${server}\\${share}\\`;
        }

        const mWsl = /^\/\/wsl\/([^/]+)(?:\/(.*))?$/.exec(p);
        if (mWsl) {
            const distro = mWsl[1];
            const rest = mWsl[2] ?? "";
            const restWin = rest.split("/").join("\\");
            return restWin ? `\\\\wsl.localhost\\${distro}\\${restWin}` : `\\\\wsl.localhost\\${distro}\\`;
        }

        if (p.startsWith("//msys/")) {
            return undefined;
        }

        return undefined;
    }

    protected toPosixBackendPath(p: string): string {
        if (p.startsWith("//")) {
            throw new Error(`Virtual namespace cannot be used as posix backend path: ${p}`);
        }
        return p;
    }

    protected quoteForShell(raw: string | undefined, mode: "never" | "if-needed" | "always"): string | undefined {
        if(raw === undefined) return undefined;

        if (mode === "never") return raw;

        if (mode === "if-needed" && !this.needsQuoting(raw)) return raw;

        return this.applyQuoting(raw);
    }

    protected needsQuoting(raw: string): boolean {
        return /[\\'"$`!*?|&;<>(){}\[\]\n\s]/.test(raw);
    }

    protected applyQuoting(raw: string): string {
        return `'${raw.replace(/'/g, `'\\''`)}'`;
    }

    protected normalizeCognoAbs(p: string): string {
        const s = p.replace(/\\/g, "/");
        const keepDouble = s.startsWith("//");
        const abs = keepDouble ? s : (s.startsWith("/") ? s : "/" + s);

        const parts = abs.split("/");
        const out: string[] = [];
        for (const seg of parts) {
            if (!seg || seg === ".") continue;
            if (seg === "..") {
                if (out.length) out.pop();
                continue;
            }
            out.push(seg);
        }
        return (keepDouble ? "//" : "/") + out.join("/");
    }

    protected normalizePlainSlashes(s: string): string {
        return s.replace(/\\/g, "/").replace(/\/{3,}/g, "//");
    }

    parentOf(cognoPath: string): string | null {
        const p = this.stripTrailingSlash(cognoPath);
        if (p === "/" || p === "") return null;

        const idx = p.lastIndexOf("/");
        if (idx <= 0) return "/";

        return p.slice(0, idx);
    }

    basenameOf(cognoPath: string): string {
        const p = this.stripTrailingSlash(cognoPath);
        if (p === "/" || p === "") return "/";
        const idx = p.lastIndexOf("/");
        return idx >= 0 ? p.slice(idx + 1) : p;
    }

    depthOf(cognoPath: string): number {
        const p = this.stripTrailingSlash(cognoPath);
        if (p === "/" || p === "") return 0;
        return p.split("/").filter(Boolean).length;
    }

    private stripTrailingSlash(p: string): string {
        if (!p) return p;
        if (p === "/") return p;
        return p.replace(/\/+$/, "");
    }
}
