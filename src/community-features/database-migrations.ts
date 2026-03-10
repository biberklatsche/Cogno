import { DatabaseMigrationContract } from "@cogno/core-sdk";
import { workspaceDatabaseMigrations } from "./workspace/workspace.migrations";

export const communityFeatureDatabaseMigrations: ReadonlyArray<DatabaseMigrationContract> = [
  ...workspaceDatabaseMigrations,
];
