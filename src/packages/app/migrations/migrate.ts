import { registerDatabaseMigrations } from "@cogno/core-api";
import addHistoryMigration from "./003_add_history.sql?raw";
import addCommandTransitionsMigration from "./004_add_command_transitions.sql?raw";
import addCommandPatternsMigration from "./005_add_command_patterns.sql?raw";
import addCommandPatternFeedbackMigration from "./006_add_command_pattern_feedback.sql?raw";
import cleanupPatternFeedbackColumnsMigration from "./007_cleanup_pattern_feedback_columns.sql?raw";
import addCommandLogMigration from "./008_add_command_log.sql?raw";

export const appDatabaseMigrations = registerDatabaseMigrations("app", [
  { name: "add-command-history", sql: addHistoryMigration },
  { name: "add-command-transitions", sql: addCommandTransitionsMigration },
  { name: "add-command-patterns", sql: addCommandPatternsMigration },
  { name: "add-command-pattern-feedback", sql: addCommandPatternFeedbackMigration },
  { name: "cleanup-pattern-feedback-columns", sql: cleanupPatternFeedbackColumnsMigration },
  { name: "add-command-log", sql: addCommandLogMigration },
]);
