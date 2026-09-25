/**
 * Hook event names of the Claude Code hook protocol. Codex and Kimi CLI speak the
 * same protocol, so their configs and interpreters use these names too.
 */
export const CLAUDE_STYLE_HOOK_EVENT = {
  sessionStart: "SessionStart",
  sessionEnd: "SessionEnd",
  userPromptSubmit: "UserPromptSubmit",
  subagentStart: "SubagentStart",
  subagentStop: "SubagentStop",
  preToolUse: "PreToolUse",
  postToolUse: "PostToolUse",
  postToolUseFailure: "PostToolUseFailure",
  notification: "Notification",
  permissionRequest: "PermissionRequest",
  permissionDenied: "PermissionDenied",
  stop: "Stop",
  stopFailure: "StopFailure",
  preCompact: "PreCompact",
  postCompact: "PostCompact",
  taskCompleted: "TaskCompleted",
} as const;

/** `source` of a SessionStart that only continues the session after compaction. */
export const SESSION_START_SOURCE_COMPACT = "compact";
