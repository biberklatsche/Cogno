import { registerDatabaseMigrations } from "@cogno/core-api";
import migration001InitializeWorkspace from "./migrations/001_init_workspace.sql?raw";

export const workspaceDatabaseMigrations = registerDatabaseMigrations("workspace", [
  { name: "init-schema", sql: migration001InitializeWorkspace },
]);
