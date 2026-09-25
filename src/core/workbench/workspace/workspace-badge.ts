import {
  DEFAULT_WORKSPACE_COLOR,
  defaultWorkspaceIdContract,
  WorkspaceEntryContract,
} from "@cogno/shared/domain";
import { LetterBadge, LetterBadgeMarker } from "@cogno/shared/ui";

/** The letter badge of a workspace, shared by the side panel and the header's quick select. */
export function workspaceBadge(
  entry: WorkspaceEntryContract,
  restoreEnabled: boolean,
): LetterBadge {
  return {
    letter: (entry.name || "")[0] || "?",
    color: `var(--color-${entry.color ?? DEFAULT_WORKSPACE_COLOR})`,
    textColor:
      entry.id === defaultWorkspaceIdContract
        ? "var(--foreground-color)"
        : "var(--background-color)",
    marker: workspaceBadgeMarker(entry, restoreEnabled),
  };
}

/** Failed autosave beats unsaved edits beats the active mark. */
function workspaceBadgeMarker(
  entry: WorkspaceEntryContract,
  restoreEnabled: boolean,
): LetterBadgeMarker | undefined {
  if (restoreEnabled && entry.autoSaveFailed) {
    return {
      icon: "mdiAlert",
      color: "var(--color-red)",
      tooltip: `${entry.name} · auto-save failed`,
    };
  }
  if (!restoreEnabled && entry.isDirty) {
    return { icon: "mdiViewDashboardEdit" };
  }
  if (entry.isActive) {
    return { icon: "mdiCheck" };
  }
  return undefined;
}
