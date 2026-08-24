import { registerDatabaseMigrations } from "@cogno/core-api";
import initHistoryMigration from "./001_init_history.sql?raw";
import importLegacyHistoryMigration from "./002_import_legacy_history.sql?raw";

export const appDatabaseMigrations = registerDatabaseMigrations("app", [
  { name: "init-history", sql: initHistoryMigration },
  { name: "import-legacy-history", sql: importLegacyHistoryMigration, usesLegacy: true },
]);
