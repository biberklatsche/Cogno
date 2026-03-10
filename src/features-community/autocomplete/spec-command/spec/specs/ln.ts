import type { ArgSpec, CommandSpec } from "../spec.types";
const sourceDestArgs: ArgSpec[] = [
    {
        name: "source_file"
    },
    {
        name: "link_name or link_dirname"
    }
];
const completionSpec: CommandSpec = {
    name: "ln",
    description: "Create (default hard) symbolic links to files",
    options: [
        {
            name: "-s",
            description: "Create a symbolic link",
            args: sourceDestArgs
        },
        {
            name: "-v",
            description: "Verbose"
        },
        {
            name: "-F",
            description: "If link name already exists replace it",
            args: sourceDestArgs
        },
        {
            name: "-h",
            description: "Don't follow symbolic links"
        },
        {
            name: "-f",
            description: "If link name already exists unlink the old one before creating the new one",
            args: sourceDestArgs
        },
        {
            name: "-i",
            description: "Prompt if proposed link already exists",
            args: sourceDestArgs
        },
        {
            name: "-n",
            description: "Same as -h don't follow symbolic links"
        }
    ]
};
export default completionSpec;
