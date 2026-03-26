import { registerDatabaseMigrations } from "@cogno/core-sdk";
import migration001InitializeWorkspace from "./migrations/001_init_workspace.sql?raw";
import migration002AddWorkspaceAutosave from "./migrations/002_add_workspace_autosave.sql?raw";
import migration004AddWorkspaceTabTitleLock from "./migrations/004_add_workspace_tab_title_lock.sql?raw";
import migration005AddWorkspacePosition from "./migrations/005_add_workspace_position.sql?raw";

export const workspaceDatabaseMigrations = registerDatabaseMigrations("workspace", [
  { name: "init-schema", sql: migration001InitializeWorkspace },
  { name: "add-autosave-flag", sql: migration002AddWorkspaceAutosave },
  { name: "add-tab-title-lock", sql: migration004AddWorkspaceTabTitleLock },
  { name: "add-workspace-position", sql: migration005AddWorkspacePosition },
]);
