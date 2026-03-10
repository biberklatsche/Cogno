import type { CommandSpec } from "../spec.types";
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
                default: unknown;
            }>;
            options: [
            ] | Record<string, {
                name: string;
                accept_value: boolean;
                shortcut: string;
                is_value_required: boolean;
                is_multiple: boolean;
                description: string;
                default: unknown;
            }>;
        };
    }[];
}
const getEnvConfig = async (executeShellCommand) => {
    const command = "php -r 'print(json_encode(require \"app/etc/env.php\"));'";
    const out = await executeShellCommand(command);
    return JSON.parse(out);
};
const getCacheTypes = async (executeShellCommand) => {
    const env = await getEnvConfig(executeShellCommand);
    return Object.keys(env.cache_types);
};
const completionSpec: CommandSpec = {
    name: "magento",
    description: "Open-source E-commerce"
};
export default completionSpec;
