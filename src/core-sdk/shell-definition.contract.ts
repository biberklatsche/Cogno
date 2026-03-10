import { ShellPathAdapterDefinitionContract } from "./shell-path-adapter-definition.contract";
import { ShellSupportDefinitionContract } from "./shell-support.contract";

export interface ShellDefinitionContract {
  readonly support: ShellSupportDefinitionContract;
  readonly pathAdapter: ShellPathAdapterDefinitionContract;
}
