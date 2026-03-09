import {BasePathAdapter} from "../base/base-path.adapter";
import {ShellContext} from "../../model/models";

export class FishPathAdapter extends BasePathAdapter {
    constructor(ctx: Omit<ShellContext, "shellType">) {
        super({...ctx, shellType: 'Fish'});
    }
}
