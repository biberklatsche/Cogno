import { registerDatabaseMigrations } from "@cogno/core-api";
import migration001InitUiState from "./migrations/001_init_ui_state.sql?raw";

export const sideMenuUiStateMigrations = registerDatabaseMigrations("side-menu-ui-state", [
  { name: "init-ui-state", sql: migration001InitUiState },
]);
