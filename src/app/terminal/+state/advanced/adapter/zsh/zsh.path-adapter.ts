import {BasePathAdapter} from "../base/base-path.adapter";
import {ShellContext} from "../../data/models";

export class ZshPathAdapter extends BasePathAdapter {
    constructor(ctx: Omit<ShellContext, "shellType">) {
        super({...ctx, shellType: 'ZSH'});
    }
}
