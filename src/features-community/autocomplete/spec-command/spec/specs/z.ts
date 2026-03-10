import type { CommandSpec } from "../spec.types";
interface ZSuggestion {
    name: string;
    path: string;
    weight?: number;
    time?: number;
}
async function getZHistory(execute: ExecuteCommandFunction): Promise<ZSuggestion[]> {
    const { stdout } = await execute({
        command: "zsh",
        args: ["-c", "cat ${${ZSHZ_DATA:-${_Z_DATA:-${HOME}/.z}}:A}"],
    });
    return stdout.split("\n").map((line) => {
        const [path, weight, time] = line.split("|");
        const splitPath = path.split("/");
        const name = splitPath[splitPath.length - 1];
        return {
            name,
            path,
            // Fig should defer assigning priority to z.
            // 75 added to keep args above options.
            // NOTE: 9000 is the default max priority. If a custom value is set this will work if "custom_value <= 9000" but not otherwise
            weight: 75 + (Number(weight) * 25) / 9000,
            time: Number(time),
        };
    });
}
async function getCurrentDirectoryFolders(currentWorkingDirectory: string, execute: ExecuteCommandFunction): Promise<ZSuggestion[]> {
    const { stdout } = await execute({
        command: "bash",
        args: ["-c", "ls -d */"],
    });
    return stdout.split("\n").map((line) => {
        const name = line.replace("/", "");
        return {
            name,
            path: `${currentWorkingDirectory}/${name}`,
        };
    });
}
function filterHistoryBySearchTerms(insertedTerms: string[], history: ZSuggestion[]): ZSuggestion[] {
    const insertedTermsMap = new Set(insertedTerms);
    return history.filter(({ name, path }) => !insertedTermsMap.has(name) &&
        insertedTerms.every((item) => path.includes(item)));
}
// https://github.com/rupa/z
const zShCompletionSpec: CommandSpec = {
    name: "z",
    description: "CLI tool to jump around directories",
    options: [
        {
            name: "-c",
            description: "Restrict matches to subdirectories of the current directory"
        },
        { name: "-e", description: "Echo the best match, don't cd" },
        { name: "-h", description: "Show a brief help message" },
        { name: "-l", description: "List only" },
        { name: "-r", description: "Match by rank only" },
        { name: "-t", description: "Match by recent access only" },
        {
            name: "-x",
            description: "Remove the current directory from the datafile"
        }
    ]
};
// https://github.com/ajeetdsouza/zoxide
const zoxideCompletionSpec: CommandSpec = {
    name: "z",
    description: "Smarter cd command, inspired by z and autojump"
};
const zCompletionSpec: CommandSpec = {
    name: "z"
};
export default zCompletionSpec;
