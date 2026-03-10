import type { ArgSpec, CommandSpec } from "../../spec.types";
interface BinConsoleJSON {
    commands: {
        name: string;
        description: string;
        hidden: boolean;
        help: string;
        definition: {
            arguments: [
            ] | Record<string, {
                name: string;
                is_required: boolean;
                description: string;
                is_array: boolean;
            }>;
            options: [
            ] | Record<string, {
                name: string;
                accept_value: boolean;
                shortcut: string;
                is_value_required: boolean;
                is_multiple: boolean;
                description: string;
            }>;
        };
    }[];
}
const completionSpec: CommandSpec = {
    name: "bin-console",
    description: "Symfony bin/console command"
};
export default completionSpec;
