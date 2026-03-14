import { registerDatabaseMigrations } from "@cogno/core-sdk";
import addHistoryMigration from "./003_add_history.sql?raw";
import addCommandTransitionsMigration from "./004_add_command_transitions.sql?raw";

export const appDatabaseMigrations = registerDatabaseMigrations("app", [
  { name: "add-command-history", sql: addHistoryMigration },
  { name: "add-command-transitions", sql: addCommandTransitionsMigration },
]);
