import { registerDatabaseMigrations } from "@cogno/core-sdk";
import addHistoryMigration from "./003_add_history.sql?raw";

export const appDatabaseMigrations = registerDatabaseMigrations("app", [
  { name: "add-command-history", sql: addHistoryMigration },
]);
