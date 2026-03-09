import { DatabaseMigrationContract } from "@cogno/core-sdk";
import migration001InitializeWorkspace from "./migrations/001_init_workspace.sql?raw";
import migration002AddWorkspaceAutosave from "./migrations/002_add_workspace_autosave.sql?raw";
import migration004AddWorkspaceTabTitleLock from "./migrations/004_add_workspace_tab_title_lock.sql?raw";

export const workspaceMigrations: ReadonlyArray<DatabaseMigrationContract> = [
  { id: "001_init_workspace", sql: migration001InitializeWorkspace },
  { id: "002_add_workspace_autosave", sql: migration002AddWorkspaceAutosave },
  { id: "004_add_workspace_tab_title_lock", sql: migration004AddWorkspaceTabTitleLock },
];
