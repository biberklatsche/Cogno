import {
  BasePathAdapter,
  ShellContextContract,
  ShellPathAdapterDefinitionContract,
} from "@cogno/core-sdk";

type ShellAdapterContext = {
  backendOs: ShellContextContract["backendOs"];
  wslDistroName?: string;
};

export class BashPathAdapter extends BasePathAdapter {
  constructor(ctx: ShellAdapterContext) {
    super({ ...ctx, shellType: "Bash" });
  }
}

export const bashShellPathAdapterDefinition: ShellPathAdapterDefinitionContract = {
  shellType: "Bash",
  createPathAdapter: shellContext => new BashPathAdapter(shellContext),
};
