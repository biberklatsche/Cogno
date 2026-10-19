import { registerDatabaseMigrations } from "@cogno/core/api/contributions";
import migration001InitUiState from "./migrations/001_init_ui_state.sql?raw";
import migration002ImportLegacyUiState from "./migrations/002_import_legacy_ui_state.sql?raw";
import migration003AddExpanded from "./migrations/003_add_expanded.sql?raw";
import migration004ExpandedPanels from "./migrations/004_expanded_panels.sql?raw";

export const sideMenuUiStateMigrations = registerDatabaseMigrations("side-menu-ui-state", [
  { name: "init-ui-state", sql: migration001InitUiState },
  { name: "import-legacy", sql: migration002ImportLegacyUiState, usesLegacy: true },
  { name: "add-expanded", sql: migration003AddExpanded },
  { name: "expanded-panels", sql: migration004ExpandedPanels },
]);
