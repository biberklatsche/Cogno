import {
  BasePathAdapter,
  ShellContextContract,
  ShellPathAdapterDefinitionContract,
} from "@cogno/core-sdk";

type ShellAdapterContext = {
  backendOs: ShellContextContract["backendOs"];
  wslDistroName?: string;
};

export class GitBashPathAdapter extends BasePathAdapter {
  constructor(ctx: ShellAdapterContext) {
    super({ ...ctx, shellType: "GitBash" });
  }

  protected override normalizeUnixPath(s: string): string {
    const mMsysDrive = /^\/([A-Za-z])\/(.*)$/.exec(s);
    if (mMsysDrive) {
      const drive = mMsysDrive[1].toLowerCase();
      return this.normalizeCognoAbs(`/${drive}/${mMsysDrive[2] ?? ""}`);
    }
    return this.normalizeCognoAbs(`//msys/${s.replace(/^\/+/, "")}`);
  }

  protected override toShellView(p?: string): string | undefined {
    if (p === undefined) return undefined;
    if (/^\/[a-z]\//.test(p)) return p;

    const mUnc = /^\/\/unc\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(p);
    if (mUnc) {
      const rest = mUnc[3] ?? "";
      return this.normalizePlainSlashes(`//${mUnc[1]}/${mUnc[2]}/${rest}`);
    }

    const mMsys = /^\/\/msys\/(.*)$/.exec(p);
    if (mMsys) return this.normalizePlainSlashes(`/${mMsys[1] ?? ""}`);

    const mWsl = /^\/\/wsl\/([^/]+)(?:\/(.*))?$/.exec(p);
    if (mWsl) {
      const distro = mWsl[1];
      const rest = mWsl[2] ?? "";
      return this.normalizePlainSlashes(`//wsl.localhost/${distro}/${rest}`);
    }

    return p;
  }
}

export const gitBashShellPathAdapterDefinition: ShellPathAdapterDefinitionContract = {
  shellType: "GitBash",
  createPathAdapter: shellContext => new GitBashPathAdapter(shellContext),
};
