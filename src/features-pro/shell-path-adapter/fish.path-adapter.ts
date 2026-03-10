import {
  BasePathAdapter,
  ShellContextContract,
  ShellPathAdapterDefinitionContract,
} from "@cogno/core-sdk";

type ShellAdapterContext = {
  backendOs: ShellContextContract["backendOs"];
  wslDistroName?: string;
};

export class FishPathAdapter extends BasePathAdapter {
  constructor(ctx: ShellAdapterContext) {
    super({ ...ctx, shellType: "Fish" });
  }
}

export const fishShellPathAdapterDefinition: ShellPathAdapterDefinitionContract = {
  shellType: "Fish",
  createPathAdapter: shellContext => new FishPathAdapter(shellContext),
};
