import {BasePathAdapter} from "../base/base-path.adapter";
import {ShellContext} from "../../model/models";

export class GitBashPathAdapter extends BasePathAdapter {
    constructor(ctx: Omit<ShellContext, "shellType">) {
        super({...ctx, shellType: 'GitBash'});
    }

    protected override normalizeUnixPath(s: string): string {
        // Git-Bash rule:
        // - /c/... is host drive mapping
        // - everything else is MSYS virtual, including /home/...
        const mMsysDrive = /^\/([A-Za-z])\/(.*)$/.exec(s);
        if (mMsysDrive) {
            // exact one-letter segment => drive mapping
            const drive = mMsysDrive[1].toLowerCase();
            return this.normalizeCognoAbs(`/${drive}/${mMsysDrive[2] ?? ""}`);
        }
        return this.normalizeCognoAbs(`//msys/${s.replace(/^\/+/, "")}`);
    }

    protected override toShellView(p?: string): string | undefined {
        if(p === undefined) return undefined;
        if (/^\/[a-z]\//.test(p)) return p;

        const mUnc = /^\/\/unc\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(p);
        if (mUnc) {
            const rest = mUnc[3] ?? "";
            return this.normalizePlainSlashes(`//${mUnc[1]}/${mUnc[2]}/${rest}`);
        }

        const mMsys = /^\/\/msys\/(.*)$/.exec(p);
        if (mMsys) return this.normalizePlainSlashes("/" + (mMsys[1] ?? ""));

        const mWsl = /^\/\/wsl\/([^/]+)(?:\/(.*))?$/.exec(p);
        if (mWsl) {
            const distro = mWsl[1];
            const rest = mWsl[2] ?? "";
            return this.normalizePlainSlashes(`//wsl.localhost/${distro}/${rest}`);
        }

        return p;
    }
}
