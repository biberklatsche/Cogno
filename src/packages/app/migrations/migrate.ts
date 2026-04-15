import { registerDatabaseMigrations } from "@cogno/core-api";
import addHistoryMigration from "./003_add_history.sql?raw";
import addCommandTransitionsMigration from "./004_add_command_transitions.sql?raw";
import addCommandPatternsMigration from "./005_add_command_patterns.sql?raw";
import addCommandPatternFeedbackMigration from "./006_add_command_pattern_feedback.sql?raw";

export const appDatabaseMigrations = registerDatabaseMigrations("app", [
  { name: "add-command-history", sql: addHistoryMigration },
  { name: "add-command-transitions", sql: addCommandTransitionsMigration },
  { name: "add-command-patterns", sql: addCommandPatternsMigration },
  { name: "add-command-pattern-feedback", sql: addCommandPatternFeedbackMigration },
]);
