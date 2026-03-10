import type { CommandSpec, OptionSpec } from "../spec.types";
const commonOptions: OptionSpec[] = [
    {
        name: ["--help", "-h"],
        description: "Display usage information"
    }
];
const buildOptions: OptionSpec[] = [
    {
        name: ["-i", "--input"],
        description: "Specify input file",
        args: { name: "input file" }
    },
    {
        name: ["-o", "--output"],
        description: "Specify output file",
        args: { name: "output file" }
    },
    {
        name: ["-c", "--config"],
        description: "Specify config file to use",
        args: { name: "config file" }
    },
    {
        name: "--postcss",
        description: "Load custom PostCSS configuration",
        args: {
            name: "postcss config file"
        }
    },
    {
        name: "--purge",
        description: "Content paths to use for removing unused classes. [Deprecated]: use `--content` instead"
    },
    {
        name: "--content",
        description: "Content paths to use for removing unused classes"
    },
    {
        name: ["--watch", "-w"],
        description: "Watch for changes and rebuild as needed"
    },
    {
        name: ["--minify", "-m"],
        description: "Minify the output"
    },
    {
        name: "--no-autoprefixer",
        description: "Disable autoprefixer"
    },
    ...commonOptions
];
const completionSpec: CommandSpec = {
    name: "tailwindcss",
    description: "Tailwindcss CLI tools",
    options: buildOptions,
    subcommands: [
        {
            name: "init",
            description: "Creates Tailwind config file. Default: tailwind.config.js",
            args: {
                name: "filename"
            },
            options: [
                {
                    name: ["-p", "--postcss"],
                    description: "Initialize a 'postcss.config.js' file"
                },
                {
                    name: ["-f", "--full"],
                    description: "Initialize a full 'tailwind.config.js' file"
                },
                ...commonOptions
            ]
        },
        {
            name: "build",
            description: "Build CSS file",
            options: buildOptions
        }
    ]
};
export default completionSpec;
