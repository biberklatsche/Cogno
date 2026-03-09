import { BasePathAdapter } from "./base-path.adapter";
import { ShellContext } from "./shell-context";

export class ZshPathAdapter extends BasePathAdapter {
    constructor(ctx: Omit<ShellContext, "shellType">) {
        super({ ...ctx, shellType: "ZSH" });
    }
}
