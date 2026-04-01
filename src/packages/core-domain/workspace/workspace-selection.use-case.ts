import { WorkspaceEntryContract } from "@cogno/core-api";

export type WorkspaceSelectionDirection = "up" | "down" | "left" | "right";
export type WorkspaceSelectionState = WorkspaceEntryContract & { readonly isSelected: boolean };

export class WorkspaceSelectionUseCase {
  static initializeSelection(
    workspaceEntries: ReadonlyArray<WorkspaceSelectionState>,
  ): WorkspaceSelectionState[] {
    if (workspaceEntries.length === 0) {
      return [...workspaceEntries];
    }
    if (workspaceEntries.some((workspaceEntry) => workspaceEntry.isSelected)) {
      return [...workspaceEntries];
    }
    return workspaceEntries.map((workspaceEntry, index) => ({
      ...workspaceEntry,
      isSelected: index === 0,
    }));
  }

  static updateWorkspaceEntries(
    currentWorkspaceEntries: ReadonlyArray<WorkspaceSelectionState>,
    nextWorkspaceEntries: ReadonlyArray<WorkspaceEntryContract>,
  ): WorkspaceSelectionState[] {
    const currentlySelectedWorkspaceId = currentWorkspaceEntries.find(
      (workspaceEntry) => workspaceEntry.isSelected,
    )?.id;
    const activeWorkspaceId = nextWorkspaceEntries.find((workspaceEntry) => workspaceEntry.isActive)?.id;
    const selectedWorkspaceId =
      currentlySelectedWorkspaceId ?? activeWorkspaceId ?? nextWorkspaceEntries.at(0)?.id;

    return nextWorkspaceEntries.map((workspaceEntry) => ({
      ...workspaceEntry,
      isSelected: workspaceEntry.id === selectedWorkspaceId,
    }));
  }

  static selectNext(
    workspaceEntries: ReadonlyArray<WorkspaceSelectionState>,
    direction: WorkspaceSelectionDirection,
    resolveNavigationTarget?: (
      activeWorkspaceId: string,
      direction: WorkspaceSelectionDirection,
    ) => string | undefined,
  ): WorkspaceSelectionState[] {
    if (workspaceEntries.length === 0) {
      return [...workspaceEntries];
    }

    const currentIndex = workspaceEntries.findIndex((workspaceEntry) => workspaceEntry.isSelected);
    const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
    const activeWorkspaceId = workspaceEntries[safeCurrentIndex]?.id;
    const nextWorkspaceId = activeWorkspaceId
      ? resolveNavigationTarget?.(activeWorkspaceId, direction)
      : undefined;
    const nextIndex =
      nextWorkspaceId === undefined
        ? this.resolveFallbackIndex(workspaceEntries.length, safeCurrentIndex, direction)
        : this.resolveNavigationIndex(workspaceEntries, nextWorkspaceId, safeCurrentIndex, direction);

    return workspaceEntries.map((workspaceEntry, index) => ({
      ...workspaceEntry,
      isSelected: index === nextIndex,
    }));
  }

  static getSelectedWorkspaceId(
    workspaceEntries: ReadonlyArray<WorkspaceSelectionState>,
  ): string | undefined {
    return workspaceEntries.find((workspaceEntry) => workspaceEntry.isSelected)?.id;
  }

  private static resolveNavigationIndex(
    workspaceEntries: ReadonlyArray<WorkspaceSelectionState>,
    nextWorkspaceId: string,
    safeCurrentIndex: number,
    direction: WorkspaceSelectionDirection,
  ): number {
    const nextIndex = workspaceEntries.findIndex((workspaceEntry) => workspaceEntry.id === nextWorkspaceId);
    if (nextIndex >= 0) {
      return nextIndex;
    }
    return this.resolveFallbackIndex(workspaceEntries.length, safeCurrentIndex, direction);
  }

  private static resolveFallbackIndex(
    workspaceCount: number,
    safeCurrentIndex: number,
    direction: WorkspaceSelectionDirection,
  ): number {
    if (direction === "left" || direction === "up") {
      return (safeCurrentIndex - 1 + workspaceCount) % workspaceCount;
    }
    return (safeCurrentIndex + 1) % workspaceCount;
  }
}
