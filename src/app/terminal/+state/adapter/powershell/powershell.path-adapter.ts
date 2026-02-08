import {BasePathAdapter} from "../base/base-path.adapter";
import {ShellType} from "../../../../config/+models/shell-config";
import {OsType} from "../../../../_tauri/os";
import {RenderContext, ShellContext} from "../base/path-adapter.interface";

export class PowerShellPathAdapter extends BasePathAdapter {

    constructor(ctx: Omit<ShellContext, "shellType">) {
        super({...ctx, shellType: 'PowerShell'});
    }
    protected override toShellView(p: string): string | undefined{
        return this.toWindowsBackendPath(p);
    }

    protected override needsQuoting(raw: string): boolean {
        return /\s/.test(raw) || /[`"'$&|<>(){};]/.test(raw);
    }

    protected override applyQuoting(raw: string): string {
        return `'${raw.replace(/'/g, "''")}'`;
    }
}
