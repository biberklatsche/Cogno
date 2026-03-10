import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "knex",
    description: "SQL query builder for JavaScript",
    subcommands: [
        {
            name: "init",
            description: "Create a fresh knexfile"
        },
        {
            name: "migrate:make",
            description: "Create a named migration file",
            args: { name: "migration name" }
        },
        {
            name: "migrate:latest",
            description: "Run all migrations that have not yet been run"
        },
        {
            name: "migrate:up",
            description: "Run the next or the specified migration that has not yet been run"
        },
        {
            name: "migrate:rollback",
            description: "Rollback the last batch of migrations performed"
        },
        {
            name: "migrate:down",
            description: "Undo the last or the specified migration that was already run"
        },
        {
            name: "migrate:currentVersion",
            description: "View the current version for the  migration"
        },
        {
            name: "migrate:list|migrate:status",
            description: "List all migrations files with status"
        },
        {
            name: "migrate:unlock",
            description: "Forcibly unlocks the migrations lock table"
        },
        {
            name: "seed:make",
            description: "Create a named seed file",
            args: {
                name: "seed name"
            }
        },
        {
            name: "seed:run",
            description: "Run seed files"
        },
        {
            name: "help",
            description: "Display help for command"
        }
    ],
    options: [
        {
            name: "--version",
            description: "Output the version number"
        },
        {
            name: "--debug",
            description: "Run with debugging"
        },
        {
            name: "--knexfile",
            description: "Specify the knexfile path"
        },
        {
            name: "--knexpath",
            description: "Specify the path to knex instance"
        },
        {
            name: "--cwd",
            description: "Specify the working directory"
        },
        {
            name: "--client",
            description: "Set DB client without a knexfile"
        },
        {
            name: "--connection",
            description: "Set DB connection without a knexfile"
        },
        {
            name: "--migrations-directory",
            description: "Set migrations directory without a knexfile"
        },
        {
            name: "--migrations-table-name",
            description: "Set migrations table name without a knexfile"
        },
        {
            name: "--env",
            description: "Environment, default: process.env.NODE_ENV || development",
            args: {
                name: "environment"
            }
        },
        {
            name: "--esm",
            description: "Enable ESM interop"
        },
        {
            name: "--specific",
            description: "Specify one seed file to execute"
        },
        {
            name: "--timestamp-filename-prefix",
            description: "Enable a timestamp prefix on name of generated seed files"
        },
        {
            name: "--help",
            description: "Display help for command"
        }
    ]
};
export default completionSpec;
