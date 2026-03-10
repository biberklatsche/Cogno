import type { CommandSpec, Generator, SubcommandSpec, Suggestion } from "../../spec.types";
type SearchResultData = {
    id: string;
    title: string;
    description: string;
};
const searchGenerator: Generator = {
    script(context) {
        const searchTerm = context[context.length - 1];
        return [
            "curl",
            "-sfL",
            "-H",
            "Accept: application/json",
            `https://azuresearch-usnc.nuget.org/query?packageType=Template&q=${searchTerm}`
        ];
    },
    postProcess(out) {
        const searchResults: SearchResultData[] = JSON.parse(out).data;
        return searchResults.map<Suggestion>((value) => {
            return {
                name: value.title,
                insertValue: value.id,
                description: value.description,
            };
        });
    },
};
const commands: SubcommandSpec[] = [
    {
        name: "--list",
        description: "The dotnet new --list option lists available templates to use with dotnet new",
        options: [
            {
                name: "--author"
            },
            {
                name: "--columns",
                description: "Comma-separated list of columns to display in the output",
                args: {
                    name: "columns"
                }
            },
            {
                name: "--columns-all",
                description: "Displays all columns in the output. Available since .NET Core 5.0.300 SDK"
            },
            {
                name: "--tag",
                description: "Filters templates based on template tags. To be selected, a template must have at least one tag that exactly matches the criteria. Available since .NET Core 5.0.300 SDK",
                args: {
                    name: "tag"
                }
            },
            {
                name: "--type",
                args: {
                    name: "type"
                }
            }
        ]
    },
    {
        name: "--search",
        description: "The dotnet new --search option searches for templates supported by dotnet new on NuGet.org",
        args: {
            name: "template",
            description: "If the argument is specified, only templates containing <TEMPLATE_NAME> in the template name or short name will be shown. The argument is mandatory when --author, --language, --package, --tag or --type options are not specified"
        },
        options: [
            {
                name: "--author",
                description: "Filters templates based on template author. Partial match is supported",
                args: {
                    name: "author"
                }
            },
            {
                name: "--columns",
                description: "Comma-separated list of columns to display in the output",
                args: {
                    name: "columns"
                }
            },
            {
                name: "--columns-all",
                description: "Displays all columns in the output"
            },
            {
                name: ["-lang", "--language"],
                description: "Filters templates based on language supported by the template. The language accepted varies by the template. Not valid for some templates",
                args: {
                    name: "language"
                }
            },
            {
                name: "--package",
                description: "Filters templates based on NuGet package ID. Partial match is supported",
                args: {
                    name: "package"
                }
            },
            {
                name: "--tag",
                description: "Filters templates based on template tags. To be selected, a template must have at least one tag that exactly matches the criteria",
                args: {
                    name: "tag"
                }
            },
            {
                name: "--type",
                description: "Filters templates based on template type. Predefined values are project and item",
                args: {
                    name: "type"
                }
            }
        ]
    },
    {
        name: ["-i", "--install"],
        args: {
            name: "id",
            description: "The dotnet new --install command installs a template package from the PATH or NUGET_ID provided"
        },
        options: [
            {
                name: "--interactive",
                description: "Allows the command to stop and wait for user input or action. For example, to complete authentication. Available since .NET 5.0 SDK"
            },
            {
                name: "--nuget-source",
                description: "By default, dotnet new --install uses the hierarchy of NuGet configuration files from the current directory to determine the NuGet source the package can be installed from. If --nuget-source is specified, the source will be added to the list of sources to be checked",
                args: {
                    name: "source"
                }
            }
        ]
    },
    {
        name: ["-u", "--uninstall"],
        description: "The dotnet new --uninstall command uninstalls a template package at the PATH or NUGET_ID provided",
        args: {
            name: "id"
        }
    },
    {
        name: "--update-check",
        description: "The dotnet new --update-check option checks if there are updates available for the template packs that are currently installed"
    },
    {
        name: "--update-apply",
        description: "The dotnet new --update-apply option checks if there are updates available for the template packages that are currently installed and installs them"
    }
];
const completionSpec: CommandSpec = {
    name: "new",
    description: "The dotnet new command creates a .NET project or other artifacts based on a template",
    options: [
        {
            name: "--dry-run",
            description: "Displays a summary of what would happen if the given command were run if it would result in a template creation"
        },
        {
            name: "--force",
            description: "Forces content to be generated even if it would change existing files. This is required when the template chosen would override existing files in the output directory"
        },
        {
            name: ["-?", "-h", "--help"],
            description: "Prints out help for the command. It can be invoked for the dotnet new command itself or for any template. For example, dotnet new mvc --help"
        },
        {
            name: ["-lang", "--language"],
            description: "The language of the template to create",
            args: {
                name: "language"
            }
        },
        {
            name: ["-n", "--name"],
            description: "The name for the created output. If no name is specified, the name of the current directory is used",
            args: {
                name: "output_name"
            }
        },
        {
            name: ["-o", "--output"],
            description: "Location to place the generated output. The default is the current directory",
            args: {
                name: "output_directory"
            }
        }
    ],
    subcommands: commands
};
export default completionSpec;
