import {
  BasePathAdapter,
  ShellContextContract,
  ShellPathAdapterDefinitionContract,
} from "@cogno/core-sdk";

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
  createPathAdapter: shellContext => new ZshPathAdapter(shellContext),
};
