import autojump from "./autojump";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "j",
    ...autojump
};
export default completionSpec;
