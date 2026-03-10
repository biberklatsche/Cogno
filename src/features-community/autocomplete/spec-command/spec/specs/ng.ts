import type { CommandSpec } from "../spec.types";
interface ProjectDetails {
    projectType: string;
}
const projectsGenerator = {
    script: ["ng", "config", "projects"],
    postProcess: function (out) {
        try {
            const projects = JSON.parse(out);
            return Object.entries(projects).map(([projectName, details]: [
                string,
                ProjectDetails
            ]) => ({
                name: projectName,
                description: details.projectType,
            }));
        }
        catch (e) { }
        return [];
    },
};
const projectsOption = {
    name: "--project",
    description: "Project name",
    args: {
        generators: projectsGenerator,
    },
};
const completionSpec: CommandSpec = {
    name: "ng",
    description: "CLI interface for Angular",
    subcommands: [
        {
            name: "new",
            description: "Create a new Angular app",
            args: {
                name: "name"
            },
            options: [
                {
                    name: "--create-application",
                    description: "Create a default application?",
                    args: {
                        name: "project"
                    }
                }
            ]
        },
        {
            name: "generate",
            description: "Generate new files",
            args: {
                name: "schematic"
            },
            subcommands: [
                {
                    name: "application",
                    description: "Generates a new application",
                    args: {
                        name: "name",
                        description: "Name of the new app"
                    },
                    options: [
                        {
                            name: "--style",
                            args: {
                                name: "extension"
                            }
                        }
                    ]
                },
                {
                    name: "component",
                    description: "Generate a new component",
                    args: {
                        name: "name",
                        description: "Component name"
                    },
                    options: [
                        projectsOption,
                        {
                            name: ["--change-detection", "-c"],
                            description: "The change detection strategy to use",
                            args: {
                                name: "strategy"
                            }
                        },
                        {
                            name: ["--display-block", "-b"],
                            description: "Add :host block to styles",
                            args: {
                                name: "boolean"
                            }
                        },
                        {
                            name: "--flat",
                            description: "Create at the top level",
                            args: {
                                name: "boolean"
                            }
                        }
                    ]
                },
                {
                    name: "library",
                    description: "Generates a new library",
                    args: {
                        name: "name"
                    }
                },
                {
                    name: "class",
                    description: "Generates a class",
                    args: {
                        name: "name"
                    },
                    options: [projectsOption]
                }
            ]
        },
        {
            name: "version",
            description: "View your Angular CLI version (update for Angular 14+)"
        }
    ],
    options: [
        {
            name: "--version",
            description: "View your Angular CLI version"
        }
    ]
};
export default completionSpec;
