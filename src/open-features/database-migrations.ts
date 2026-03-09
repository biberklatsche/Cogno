import { DatabaseMigrationContract } from "@cogno/core-sdk";
import { workspaceDatabaseMigrations } from "./workspace/workspace.migrations";

export const openFeatureDatabaseMigrations: ReadonlyArray<DatabaseMigrationContract> = [
  ...workspaceDatabaseMigrations,
];
