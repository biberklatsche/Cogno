import { registerDatabaseMigrations } from "@cogno/shared/contributions";
import initHistoryMigration from "./001_init_history.sql?raw";
import importLegacyHistoryMigration from "./002_import_legacy_history.sql?raw";

/**
 * The command log's tables. The source stays "app" although they live in
 * core/command-log now: a migration is identified by `source/name`, so
 * renaming the source would make an existing database look unmigrated and
 * run everything again.
 */
export const commandLogMigrations = registerDatabaseMigrations("app", [
  { name: "init-history", sql: initHistoryMigration },
  { name: "import-legacy-history", sql: importLegacyHistoryMigration, usesLegacy: true },
]);
