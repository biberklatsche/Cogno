import { ShellContextContract, ShellTypeContract } from "./filesystem.contract";
import { IPathAdapter } from "./path-adapter.contract";

export interface ShellPathAdapterDefinitionContract {
  readonly shellType: ShellTypeContract;
  createPathAdapter(shellContext: ShellContextContract): IPathAdapter;
}
