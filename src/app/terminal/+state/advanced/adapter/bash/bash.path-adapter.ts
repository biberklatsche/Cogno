import {BasePathAdapter} from "../base/base-path.adapter";
import {ShellContext} from "../../model/models";

export class BashPathAdapter extends BasePathAdapter {
    constructor(ctx: Omit<ShellContext, "shellType">) {
        super({...ctx, shellType: 'Bash'});
    }
}
