import { DatabaseMigrationContract } from "@cogno/core-sdk";
import { workspaceDatabaseMigrations } from "./side-menu/workspace/workspace.migrations";

export const featureDatabaseMigrations: ReadonlyArray<DatabaseMigrationContract> = [
  ...workspaceDatabaseMigrations,
];
