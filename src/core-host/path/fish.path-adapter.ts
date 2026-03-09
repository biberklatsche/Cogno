import { BasePathAdapter } from "./base-path.adapter";
import { ShellContext } from "./shell-context";

export class FishPathAdapter extends BasePathAdapter {
    constructor(ctx: Omit<ShellContext, "shellType">) {
        super({ ...ctx, shellType: "Fish" });
    }
}
