import type { CommandSpec, Generator } from "../spec.types";
const environmentVariableGenerator: Generator = {
    script: ["env"],
    postProcess: (out) => out.length === 0
        ? []
        : out
            .split("\n")
            .map((env) => env.split("=")[0])
            .map((suggestion) => ({
            name: `${suggestion}`,
            type: "arg",
            description: "Environment Variable",
        })),
};
const completionSpec: CommandSpec = {
    name: "unset",
    description: "Named variable shall be undefined",
    options: [
        {
            name: "-v",
            description: "Variable definition will be unset"
        }
    ]
};
export default completionSpec;
