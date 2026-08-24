import { DatabaseMigrationContract } from "@cogno/shared/contributions";
import { sideMenuUiStateMigrations } from "./side-menu/ui-state/ui-state.migrations";
import { workspaceDatabaseMigrations } from "./side-menu/workspace/workspace.migrations";

export const featureDatabaseMigrations: ReadonlyArray<DatabaseMigrationContract> = [
  ...workspaceDatabaseMigrations,
  ...sideMenuUiStateMigrations,
];
