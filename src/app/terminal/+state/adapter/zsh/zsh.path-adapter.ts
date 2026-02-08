import {BasePathAdapter} from "../base/base-path.adapter";
import {ShellType} from "../../../../config/+models/shell-config";
import {OsType} from "../../../../_tauri/os";
import {ShellContext} from "../base/path-adapter.interface";

export class ZshPathAdapter extends BasePathAdapter {
    constructor(ctx: Omit<ShellContext, "shellType">) {
        super({...ctx, shellType: 'ZSH'});
    }
}
