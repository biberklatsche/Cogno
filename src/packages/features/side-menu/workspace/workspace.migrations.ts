import { registerDatabaseMigrations } from "@cogno/shared/contributions";
import migration001InitializeWorkspace from "./migrations/001_init_workspace.sql?raw";
import migration002ImportLegacyWorkspace from "./migrations/002_import_legacy_workspace.sql?raw";

export const workspaceDatabaseMigrations = registerDatabaseMigrations("workspace", [
  { name: "init-schema", sql: migration001InitializeWorkspace },
  { name: "import-legacy", sql: migration002ImportLegacyWorkspace, usesLegacy: true },
]);
