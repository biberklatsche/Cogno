import {
  BasePathAdapter,
  ShellContextContract,
  ShellPathAdapterDefinitionContract,
} from "@cogno/core-api";

type ShellAdapterContext = {
  backendOs: ShellContextContract["backendOs"];
  wslDistroName?: string;
};

export class PowerShellPathAdapter extends BasePathAdapter {
  constructor(ctx: ShellAdapterContext) {
    super({ ...ctx, shellType: "PowerShell" });
  }

  protected override toShellView(p: string): string | undefined {
    return this.toWindowsBackendPath(p);
  }

  protected override needsQuoting(raw: string): boolean {
    return /\s/.test(raw) || /[`"'$&|<>(){};]/.test(raw);
  }

  protected override applyQuoting(raw: string): string {
    return `'${raw.replace(/'/g, "''")}'`;
  }
}

export const powerShellShellPathAdapterDefinition: ShellPathAdapterDefinitionContract = {
  shellType: "PowerShell",
  createPathAdapter: (shellContext) => new PowerShellPathAdapter(shellContext),
};
