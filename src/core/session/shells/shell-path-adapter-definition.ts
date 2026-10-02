import { IPathAdapter, ShellContextContract, ShellTypeContract } from "@cogno/shared/domain";

export interface ShellPathAdapterDefinitionContract {
  readonly shellType: ShellTypeContract;
  createPathAdapter(shellContext: ShellContextContract): IPathAdapter;
}
