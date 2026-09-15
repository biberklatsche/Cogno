import { IPathAdapter, ShellContextContract } from "@cogno/shared/domain";
import { bashShellDefinition } from "./bash/bash.shell-definition";
import { powerShellShellDefinition } from "./powershell/powershell.shell-definition";
import { zshShellDefinition } from "./zsh/zsh.shell-definition";

export const shellDefinitions = [
  bashShellDefinition,
  zshShellDefinition,
  powerShellShellDefinition,
] as const;

export const shellSupportDefinitions = shellDefinitions.map((definition) => definition.support);

export const shellPathAdapterDefinitions = shellDefinitions.map(
  (definition) => definition.pathAdapter,
);

/** The path adapter for a shell context; every shell type Cogno runs has one. */
export function createPathAdapter(context: ShellContextContract): IPathAdapter {
  const definition = shellPathAdapterDefinitions.find((d) => d.shellType === context.shellType);
  if (!definition) {
    throw new Error(`Unsupported shell type: ${context.shellType}`);
  }
  return definition.createPathAdapter(context);
}
