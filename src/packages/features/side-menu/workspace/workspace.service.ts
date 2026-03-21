import { DestroyRef, Inject, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  WorkspaceEntryContract,
  WorkspaceHostPortContract,
  workspaceHostPortToken,
} from "@cogno/core-sdk";
import { TerminalBusyStateService } from "@cogno/app/terminal/terminal-busy-state.service";

export type WorkspaceEntryViewModel = WorkspaceEntryContract & { readonly isSelected: boolean };

@Injectable({ providedIn: "root" })
export class WorkspaceService {
  private readonly workspaceEntriesSignal = signal<WorkspaceEntryViewModel[]>([]);

  readonly workspaceEntries: Signal<WorkspaceEntryViewModel[]> = this.workspaceEntriesSignal.asReadonly();

  constructor(
    @Inject(workspaceHostPortToken)
    private readonly workspaceHostPort: WorkspaceHostPortContract,
    private readonly terminalBusyStateService: TerminalBusyStateService,
    destroyRef: DestroyRef,
  ) {
    this.workspaceHostPort.workspaceEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((workspaceEntries) => {
        this.updateWorkspaceEntries(workspaceEntries);
      });
  }

  initializeSelection(): void {
    this.workspaceEntriesSignal.update((workspaceEntries) => {
      if (workspaceEntries.length === 0) {
        return workspaceEntries;
      }
      if (workspaceEntries.some((workspaceEntry) => workspaceEntry.isSelected)) {
        return workspaceEntries;
      }
      return workspaceEntries.map((workspaceEntry, index) => ({
        ...workspaceEntry,
        isSelected: index === 0,
      }));
    });
  }

  selectNext(direction: "left" | "right" | "up" | "down"): void {
    this.workspaceEntriesSignal.update((workspaceEntries) => {
      if (workspaceEntries.length === 0) {
        return workspaceEntries;
      }

      const currentIndex = workspaceEntries.findIndex((workspaceEntry) => workspaceEntry.isSelected);
      const nextIndex = this.resolveNextIndex(currentIndex, workspaceEntries.length, direction);
      return workspaceEntries.map((workspaceEntry, index) => ({
        ...workspaceEntry,
        isSelected: index === nextIndex,
      }));
    });
  }

  async restoreSelectedWorkspace(): Promise<void> {
    const selectedWorkspaceEntry = this.workspaceEntriesSignal().find((workspaceEntry) => workspaceEntry.isSelected);
    if (!selectedWorkspaceEntry) {
      return;
    }
    await this.workspaceHostPort.restoreWorkspace(selectedWorkspaceEntry.id);
  }

  async restoreWorkspace(workspaceId: string): Promise<void> {
    await this.workspaceHostPort.restoreWorkspace(workspaceId);
  }

  async closeWorkspace(workspaceId: string): Promise<void> {
    const shouldProceed = await this.terminalBusyStateService.confirmProceedIfNoBusyTerminalsInWorkspace(
      "close this workspace",
      workspaceId,
    );
    if (!shouldProceed) {
      return;
    }

    await this.workspaceHostPort.closeWorkspace(workspaceId);
  }

  openCreateWorkspaceDialog(): void {
    this.workspaceHostPort.openCreateWorkspaceDialog();
  }

  openEditWorkspaceDialog(workspaceId: string): void {
    this.workspaceHostPort.openEditWorkspaceDialog(workspaceId);
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.workspaceHostPort.deleteWorkspace(workspaceId);
  }

  private updateWorkspaceEntries(workspaceEntries: ReadonlyArray<WorkspaceEntryContract>): void {
    const currentlySelectedWorkspaceId = this.workspaceEntriesSignal().find(
      (workspaceEntry) => workspaceEntry.isSelected,
    )?.id;
    const activeWorkspaceId = workspaceEntries.find((workspaceEntry) => workspaceEntry.isActive)?.id;
    const selectedWorkspaceId = currentlySelectedWorkspaceId ?? activeWorkspaceId ?? workspaceEntries.at(0)?.id;

    this.workspaceEntriesSignal.set(
      workspaceEntries.map((workspaceEntry) => ({
        ...workspaceEntry,
        isSelected: workspaceEntry.id === selectedWorkspaceId,
      })),
    );
  }

  private resolveNextIndex(
    currentIndex: number,
    length: number,
    direction: "left" | "right" | "up" | "down",
  ): number {
    if (length <= 0) {
      return -1;
    }

    const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
    if (direction === "left") {
      return (safeCurrentIndex - 1 + length) % length;
    }
    if (direction === "right") {
      return (safeCurrentIndex + 1) % length;
    }
    if (direction === "up") {
      return (safeCurrentIndex - 2 + length) % length;
    }
    return (safeCurrentIndex + 2) % length;
  }
}
