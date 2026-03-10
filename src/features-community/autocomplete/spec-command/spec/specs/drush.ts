import type { CommandSpec, SubcommandSpec } from "../spec.types";
interface DrushArgument {
    name: string;
    is_required: boolean;
    is_array: boolean;
    description: string;
    default: null | string | Array<string>;
}
interface DrushOption {
    name: string;
    shortcut: string;
    accept_value: boolean;
    is_value_required: boolean;
    is_multiple: boolean; // isRepeatable in fig
    description: string;
    default: null | boolean; // not supported by fig
}
interface DrushCommandDefinition {
    arguments: Record<string, DrushArgument>;
    options: Record<string, DrushOption>;
}
interface DrushCommand {
    name: string;
    usage: string[];
    description: string;
    help: string;
    definition: DrushCommandDefinition;
}
interface DrushListOutput {
    commands: DrushCommand[];
}
const completionSpec: CommandSpec = {
    name: "drush",
    description: "Drush is a command line shell and Unix scripting interface for Drupal"
};
export default completionSpec;
