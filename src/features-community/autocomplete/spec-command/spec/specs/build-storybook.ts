import { storybookCommonOptions } from "./start-storybook";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "build-storybook",
    description: "Storybook build CLI tools",
    options: [
        {
            name: ["-o", "--output-dir"],
            description: "Directory where to store built files",
            args: {
                name: "directory"
            }
        },
        {
            name: ["-w", "--watch"],
            description: "Enables watch mode"
        },
        {
            name: "--loglevel",
            description: "Controls level of logging during build",
            args: {
                name: "level"
            }
        },
        ...storybookCommonOptions
    ]
};
export default completionSpec;
