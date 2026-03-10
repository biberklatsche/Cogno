import type { CommandSpec } from "../../spec.types";
interface Argument {
    name: string;
    is_required: boolean;
    is_array: boolean;
    description: string;
    default: string;
}
interface Option {
    name: string;
    shortcut: string;
    accept_value: boolean;
    is_value_required: boolean;
    is_multiple: false;
    description: string;
    default: string;
}
const completionSpec: CommandSpec = {
    name: "please",
    description: "Statamic Please command"
};
export default completionSpec;
