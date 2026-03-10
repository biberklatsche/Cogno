import { ShellDefinitionContract } from "@cogno/core-sdk";
import { powerShellShellPathAdapterDefinition } from "./powershell.path-adapter";
import { powerShellShellSupportDefinition } from "./powershell.shell-support-definition";

export const powerShellShellDefinition: ShellDefinitionContract = {
  support: powerShellShellSupportDefinition,
  pathAdapter: powerShellShellPathAdapterDefinition,
};
