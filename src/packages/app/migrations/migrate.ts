import { registerDatabaseMigrations } from "@cogno/core-api";
import initHistoryMigration from "./001_init_history.sql?raw";

export const appDatabaseMigrations = registerDatabaseMigrations("app", [
  { name: "init-history", sql: initHistoryMigration },
]);
