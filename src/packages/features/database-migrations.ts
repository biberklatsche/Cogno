import { DatabaseMigrationContract } from "@cogno/core-api";
import { workspaceDatabaseMigrations } from "./side-menu/workspace/workspace.migrations";

export const featureDatabaseMigrations: ReadonlyArray<DatabaseMigrationContract> = [
  ...workspaceDatabaseMigrations,
];



