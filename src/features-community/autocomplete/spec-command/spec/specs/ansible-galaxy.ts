import type { ArgSpec, CommandSpec, OptionSpec } from "../spec.types";
const serverOptions: OptionSpec[] = [
    {
        name: ["--server", "-s"],
        description: "The Galaxy API server URL",
        args: {
            name: "api_server",
            description: "The Galaxy API server URL"
        }
    },
    {
        name: ["--token", "--api-key"],
        description: "The Ansible Galaxy API key which can be found at https://galaxy.ansible.com/me/preferences",
        args: {
            name: "api_key",
            description: "The Ansible Galaxy API key which can be found at https://galaxy.ansible.com/me/preferences"
        }
    },
    {
        name: ["--ignore-certs", "-c"],
        description: "Ignore SSL certificate validation errors"
    }
];
const collectionDownloadOptions: OptionSpec[] = [
    {
        name: "--clear-response-cache",
        description: "Clear the existing server response cache"
    },
    {
        name: "--no-cache",
        description: "Do not use the server response cache"
    },
    {
        name: ["--no-deps", "-n"],
        description: "Don't download collection(s) listed as dependencies"
    },
    {
        name: ["--download-path", "-p"],
        description: "The directory to download the collections to",
        args: {
            name: "download_path",
            description: "The directory to download the collections to"
        }
    },
    {
        name: ["--requirements-file", "-r"],
        description: "A file containing a list of collections to be downloaded",
        args: {
            name: "requirements",
            description: "A file containing a list of collections to be downloaded"
        }
    },
    {
        name: "--pre",
        description: "Include pre-release versions"
    }
];
const collectionInitOptions: OptionSpec[] = [
    {
        name: ["--force", "-f"],
        description: "Force overwriting an existing role or collection"
    },
    {
        name: "--init-path",
        description: "The path in which the skeleton collection will be created",
        args: {
            name: "init_path",
            description: "The path in which the skeleton collection will be created"
        }
    },
    {
        name: "--collection-skeleton",
        description: "The path to a collection skeleton that the new collection should be based upon",
        args: {
            name: "collection_skeleton",
            description: "The path to a collection skeleton that the new collection should be based upon"
        }
    }
];
const collectionBuildOptions: OptionSpec[] = [
    {
        name: ["--force", "-f"],
        description: "Force overwriting an existing role or collection"
    },
    {
        name: "--output-path",
        description: "The path in which the collection is built to",
        args: {
            name: "output_path",
            description: "The path in which the collection is built to"
        }
    }
];
const collectionPublishOptions: OptionSpec[] = [
    {
        name: "--no-wait",
        description: "Don't wait for import validation results"
    },
    {
        name: "--import-timeout",
        description: "The time to wait for the collection import process to finish",
        args: {
            name: "import_timeout",
            description: "The time to wait for the collection import process to finish"
        }
    }
];
const collectionListOptions: OptionSpec[] = [
    {
        name: ["--collections-path", "-p"],
        description: "One or more directories to search for collections in addition to the default COLLECTIONS_PATHS; separate multiple paths with ':'",
        args: {
            name: "collections_path",
            description: "One or more directories to search for collections in addition to the default COLLECTIONS_PATHS; separate multiple paths with ':'"
        }
    },
    {
        name: "--format",
        description: "Format to display the list of collections in",
        args: {
            name: "format",
            description: "Format to display the list of collections in"
        }
    }
];
const collectionVerifyOptions: OptionSpec[] = [
    {
        name: ["--collections-path", "-p"],
        description: "One or more directories to search for collections in addition to the default COLLECTIONS_PATHS; separate multiple paths with ':'",
        args: {
            name: "collections_path",
            description: "One or more directories to search for collections in addition to the default COLLECTIONS_PATHS; separate multiple paths with ':'"
        }
    },
    {
        name: ["--ignore-errors", "-i"],
        description: "Ignore errors during verification and continue with the next specified collection"
    },
    {
        name: ["--requirements-file", "-r"],
        description: "A file containing a list of collections to be downloaded",
        args: {
            name: "requirements",
            description: "A file containing a list of collections to be downloaded"
        }
    }
];
const collectionsListArg: ArgSpec = {
    name: "collection",
    description: "Name of the collection"
};
const roleInitOptions: OptionSpec[] = [
    {
        name: ["--force", "-f"],
        description: "Force overwriting an existing role or collection"
    },
    {
        name: "--offline",
        description: "Don't query the galaxy API when creating roles"
    },
    {
        name: "--init-path",
        description: "The path in which the skeleton collection will be created",
        args: {
            name: "init_path",
            description: "The path in which the skeleton collection will be created"
        }
    },
    {
        name: "--role-skeleton",
        description: "The path in which the skeleton role will be created",
        args: {
            name: "role_skeleton",
            description: "The path in which the skeleton role will be created"
        }
    },
    {
        name: "--type",
        description: "Initialize using an alternate role type",
        args: {
            name: "role_type",
            description: "Initialize using an alternate role type"
        }
    }
];
const roleRemoveOptions: OptionSpec[] = [
    {
        name: ["--roles-path", "--role-path"],
        description: "The path to the directory containing your roles",
        args: {
            name: "roles_path",
            description: "The path to the directory containing your roles"
        }
    }
];
const roleListOptions: OptionSpec[] = [
    {
        name: ["--roles-path", "--role-path"],
        description: "The path to the directory containing your roles",
        args: {
            name: "roles_path",
            description: "The path to the directory containing your roles"
        }
    }
];
const roleSearchOptions: OptionSpec[] = [
    {
        name: "--platforms",
        description: "List of OS platforms to filter by",
        args: {
            name: "platforms",
            description: "List of OS platforms to filter by"
        }
    },
    {
        name: "--galaxy-tags",
        description: "List of Galaxy tags to filter by",
        args: {
            name: "galaxy_tags",
            description: "List of Galaxy tags to filter by"
        }
    },
    {
        name: "--author",
        description: "GitHub username",
        args: {
            name: "author",
            description: "GitHub username"
        }
    }
];
const roleImportOptions: OptionSpec[] = [
    {
        name: "--branch",
        description: "The name of a branch to import. Defaults to the repository's default branch (usually master)",
        args: {
            name: "reference",
            description: "The name of a branch to import. Defaults to the repository's default branch (usually master)"
        }
    },
    {
        name: "--role-name",
        description: "The name the role should have, if different than the repo name",
        args: {
            name: "role_name",
            description: "The name the role should have, if different than the repo name"
        }
    },
    {
        name: "--status",
        description: "Check the status of the most recent import request for given github_user/github_repo"
    }
];
const roleSetupOptions: OptionSpec[] = [
    {
        name: ["--roles-path", "--role-path"],
        description: "The path to the directory containing your roles",
        args: {
            name: "roles_path",
            description: "The path to the directory containing your roles"
        }
    },
    {
        name: "--remove",
        description: "Remove the integration matching the provided ID value. Use --list to see ID values",
        args: {
            name: "remove_id",
            description: "Remove the integration matching the provided ID value. Use --list to see ID values"
        }
    },
    {
        name: "--list",
        description: "List all of your integrations"
    }
];
const roleInfoOptions: OptionSpec[] = [
    {
        name: ["--roles-path", "--role-path"],
        description: "The path to the directory containing your roles",
        args: {
            name: "roles_path",
            description: "The path to the directory containing your roles"
        }
    },
    {
        name: "--offline",
        description: "Don't query the galaxy API when creating roles"
    }
];
const roleInstallOptions: OptionSpec[] = [
    {
        name: ["--roles-path", "--role-path"],
        description: "The path to the directory containing your roles",
        args: {
            name: "roles_path",
            description: "The path to the directory containing your roles"
        }
    },
    {
        name: ["--no-deps", "-n"],
        description: "Don't download roles listed as dependencies"
    },
    {
        name: "--force-with-deps",
        description: "Force overwriting an existing role and its dependencies"
    },
    {
        name: ["--requirements-file", "-r"],
        description: "A file containing a list of collections to be downloaded",
        args: {
            name: "requirements",
            description: "A file containing a list of collections to be downloaded"
        }
    },
    {
        name: ["--keep-scm-meta", "-g"],
        description: "Use tar instead of the scm archive option when packaging the role"
    }
];
const completionSpec: CommandSpec = {
    name: "ansible-galaxy",
    description: "Perform various Role and Collection related operations",
    subcommands: [
        {
            name: "collection",
            description: "Operate on collections",
            subcommands: [
                {
                    name: "download",
                    description: "Download collections",
                    options: [...serverOptions, ...collectionDownloadOptions],
                    args: collectionsListArg
                },
                {
                    name: "init",
                    description: "Initialize collections",
                    options: [...serverOptions, ...collectionInitOptions],
                    args: {
                        name: "collection_name",
                        description: "Name of the collection"
                    }
                },
                {
                    name: "build",
                    description: "Build collections",
                    options: [...serverOptions, ...collectionBuildOptions],
                    args: {
                        name: "collection",
                        description: "Path(s) to the collection to be built"
                    }
                },
                {
                    name: "publish",
                    description: "Publish collections",
                    options: [...serverOptions, ...collectionPublishOptions],
                    args: {
                        name: "collection_path",
                        description: "The path to the collection tarball to publish"
                    }
                },
                {
                    name: "list",
                    description: "List collections",
                    options: [...serverOptions, ...collectionListOptions],
                    args: {
                        name: "collection",
                        description: "The collections to list"
                    }
                },
                {
                    name: "verify",
                    description: "Verify collections",
                    options: [...serverOptions, ...collectionVerifyOptions],
                    args: {
                        name: "collection_name",
                        description: "The collections to verify"
                    }
                }
            ]
        },
        {
            name: "role",
            description: "Operate on roles",
            subcommands: [
                {
                    name: "init",
                    description: "Initialize roles",
                    options: [...serverOptions, ...roleInitOptions],
                    args: {
                        name: "role_name",
                        description: "Name of the role"
                    }
                },
                {
                    name: "remove",
                    description: "Remove roles",
                    options: [...serverOptions, ...roleRemoveOptions],
                    args: {
                        name: "role_name",
                        description: "The role to remove"
                    }
                },
                {
                    name: "list",
                    description: "List roles",
                    options: [...serverOptions, ...roleListOptions],
                    args: {
                        name: "role",
                        description: "The role to list"
                    }
                },
                {
                    name: "search",
                    description: "Search roles",
                    options: [...serverOptions, ...roleSearchOptions],
                    args: {
                        name: "searchterm",
                        description: "Search terms"
                    }
                },
                {
                    name: "import",
                    description: "Import roles",
                    options: [...serverOptions, ...roleImportOptions],
                    args: [
                        {
                            name: "github_user",
                            description: "GitHub username"
                        },
                        {
                            name: "github_repo",
                            description: "GitHub repository"
                        }
                    ]
                },
                {
                    name: "setup",
                    description: "Set up roles",
                    options: [...serverOptions, ...roleSetupOptions]
                },
                {
                    name: "info",
                    description: "Role information",
                    options: [...serverOptions, ...roleInfoOptions]
                },
                {
                    name: "install",
                    description: "Install roles",
                    options: [...serverOptions, ...roleInstallOptions]
                }
            ]
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help and exit"
        },
        {
            name: "--verbose",
            description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)"
        },
        {
            name: "-v",
            description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)",
            isRepeatable: true
        },
        {
            name: "--version",
            description: "Shows version number, config file location, module search path, module location, executable location and exit"
        }
    ]
};
export default completionSpec;
