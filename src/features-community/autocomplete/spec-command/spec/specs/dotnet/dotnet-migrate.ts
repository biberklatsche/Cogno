import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec } from "../../spec.types";
const completionSpec: CommandSpec = {
    name: "migrate",
    options: [
        {
            name: "--format-report-file-json",
            description: "Output migration report file as JSON rather than user messages",
            args: {
                name: "file"
            }
        },
        {
            name: ["-r", "--report"],
            description: "Output migration report to a file in addition to the console",
            args: {
                name: "report_file"
            }
        },
        {
            name: ["-s", "--skip-project-references"],
            description: "Skip migrating project references. By default, project references are migrated recursively",
            args: {
                name: "type"
            }
        },
        {
            name: "--skip-backup",
            description: "Skip moving project.json, global.json, and *.xproj to a backup directory after successful migration"
        },
        {
            name: ["-t", "--template-file"],
            description: "Template csproj file to use for migration. By default, the same template as the one dropped by dotnet new console is used",
            args: {
                name: "file"
            }
        },
        {
            name: ["-v", "--sdk-package-version"],
            description: "The version of the sdk package that's referenced in the migrated app. The default is the version of the SDK in dotnet new",
            args: {
                name: "version"
            }
        },
        {
            name: ["-x", "--xproj-file"],
            description: "The path to the xproj file to use. Required when there is more than one xproj in a project directory",
            args: {
                name: "file"
            }
        }
    ]
};
export default completionSpec;
