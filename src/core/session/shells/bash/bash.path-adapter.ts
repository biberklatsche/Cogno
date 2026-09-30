import { ShellPathAdapterDefinitionContract } from "@cogno/core/session/shells/shell-path-adapter-definition";
import { BasePathAdapter, ShellContextContract } from "@cogno/shared/domain";

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
  createPathAdapter: (shellContext) => new BashPathAdapter(shellContext),
};
