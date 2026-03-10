import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec } from "../../spec.types";
const projectGenerator = filepaths({ extensions: ["csproj"] });
const completionSpec: CommandSpec = {
    name: "remove",
    subcommands: [
        {
            name: "package",
            description: "The dotnet remove package command provides a convenient option to remove a NuGet package reference from a project",
            args: {
                name: "id"
            }
        },
        {
            name: "reference",
            description: "The dotnet remove reference command provides a convenient option to remove project references from a project",
            args: {
                name: "ref"
            }
        }
    ]
};
export default completionSpec;
