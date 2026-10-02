import { BasePathAdapter } from "@cogno/core/session/shells/common/base-path.adapter";
import { ShellPathAdapterDefinitionContract } from "@cogno/core/session/shells/shell-path-adapter-definition";
import { ShellContextContract } from "@cogno/shared/domain";

type ShellAdapterContext = {
  backendOs: ShellContextContract["backendOs"];
  wslDistroName?: string;
};

export class ZshPathAdapter extends BasePathAdapter {
  constructor(ctx: ShellAdapterContext) {
    super({ ...ctx, shellType: "ZSH" });
  }
}

export const zshShellPathAdapterDefinition: ShellPathAdapterDefinitionContract = {
  shellType: "ZSH",
  createPathAdapter: (shellContext) => new ZshPathAdapter(shellContext),
};
