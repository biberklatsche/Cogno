// To learn more about Fig's autocomplete standard visit: https://fig.io/docs/concepts/cli-skeleton
import type { CommandSpec } from "../spec.types";
const fileExists = async (executeCommand: ExecuteCommandFunction, file: string) => {
    return (
    // eslint-disable-next-line @withfig/fig-linter/no-useless-arrays
    (await executeCommand({ command: "ls", args: [file] })).status === 0);
};
const completionSpec: CommandSpec = {
    name: "php",
    description: "Run the PHP interpreter"
};
export default completionSpec;
