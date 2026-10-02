import { BasePathAdapter } from "@cogno/core/session/shells/common/base-path.adapter";
import { ShellPathAdapterDefinitionContract } from "@cogno/core/session/shells/shell-path-adapter-definition";
import { ShellContextContract } from "@cogno/shared/domain";

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
