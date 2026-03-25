import { DestroyRef, Inject, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  WorkspaceEntryContract,
  WorkspaceHostPortContract,
  workspaceHostPortToken,
} from "@cogno/core-sdk";
import { TerminalBusyStateService } from "@cogno/app/terminal/terminal-busy-state.service";
import {
  DirectionalNavigationItem,
  NavigationDirection,
  resolveNextNavigationTarget,
} from "../navigation/directional-navigation.engine";

export type WorkspaceEntryViewModel = WorkspaceEntryContract & { readonly isSelected: boolean };

@Injectable({ providedIn: "root" })
export class WorkspaceService {
  private readonly workspaceEntriesSignal = signal<WorkspaceEntryViewModel[]>([]);
  private navigationItemsProvider?: () => ReadonlyArray<DirectionalNavigationItem<string>>;

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

  selectNext(direction: NavigationDirection): void {
    this.workspaceEntriesSignal.update((workspaceEntries) => {
      if (workspaceEntries.length === 0) {
        return workspaceEntries;
      }

      const currentIndex = workspaceEntries.findIndex((workspaceEntry) => workspaceEntry.isSelected);
      const nextIndex = this.resolveNextIndex(workspaceEntries, currentIndex, direction);
      return workspaceEntries.map((workspaceEntry, index) => ({
        ...workspaceEntry,
        isSelected: index === nextIndex,
      }));
    });
  }

  registerNavigationItemsProvider(provider: () => ReadonlyArray<DirectionalNavigationItem<string>>): void {
    this.navigationItemsProvider = provider;
  }

  unregisterNavigationItemsProvider(provider: () => ReadonlyArray<DirectionalNavigationItem<string>>): void {
    if (this.navigationItemsProvider === provider) {
      this.navigationItemsProvider = undefined;
    }
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
    workspaceEntries: ReadonlyArray<WorkspaceEntryViewModel>,
    currentIndex: number,
    direction: NavigationDirection,
  ): number {
    if (workspaceEntries.length === 0) {
      return -1;
    }

    const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
    const activeWorkspaceId = workspaceEntries[safeCurrentIndex]?.id;
    const nextId = resolveNextNavigationTarget({
      items: this.navigationItemsProvider?.() ?? [],
      activeId: activeWorkspaceId,
      direction,
      wrap: true,
    });

    if (nextId) {
      const nextIndex = workspaceEntries.findIndex((workspaceEntry) => workspaceEntry.id === nextId);
      if (nextIndex >= 0) {
        return nextIndex;
      }
    }

    if (direction === "left" || direction === "up") {
      return (safeCurrentIndex - 1 + workspaceEntries.length) % workspaceEntries.length;
    }
    return (safeCurrentIndex + 1) % workspaceEntries.length;
  }
}
