import { ShellPathAdapterDefinitionContract } from "@cogno/shared/contributions";
import { BasePathAdapter, ShellContextContract } from "@cogno/shared/domain";

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
