import { DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  WorkspaceCloseGuard,
  WorkspaceEntryContract,
  WorkspaceHostPort,
} from "@cogno/core-api";
import {
  SelectableItemState,
  SelectableListUseCase,
  SelectionDirection,
} from "@cogno/core-domain";
import {
  DirectionalNavigationItem,
  resolveNextNavigationTarget,
} from "../navigation/directional-navigation.engine";

export type WorkspaceEntryViewModel = WorkspaceEntryContract & SelectableItemState<string>;

@Injectable({ providedIn: "root" })
export class WorkspaceService {
  private readonly workspaceEntriesSignal = signal<WorkspaceEntryViewModel[]>([]);
  private navigationItemsProvider?: () => ReadonlyArray<DirectionalNavigationItem<string>>;

  readonly workspaceEntries: Signal<WorkspaceEntryViewModel[]> = this.workspaceEntriesSignal.asReadonly();

  constructor(
    private readonly workspaceHostPort: WorkspaceHostPort,
    private readonly workspaceCloseGuard: WorkspaceCloseGuard,
    destroyRef: DestroyRef,
  ) {
    this.workspaceHostPort.workspaceEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((workspaceEntries) => {
        this.workspaceEntriesSignal.set(
          SelectableListUseCase.syncSelection(
            this.workspaceEntriesSignal(),
            workspaceEntries.map((workspaceEntry) => ({
              ...workspaceEntry,
              isSelected: false,
            })),
            workspaceEntries.find((workspaceEntry) => workspaceEntry.isActive)?.id,
          ),
        );
      });
  }

  initializeSelection(): void {
    this.workspaceEntriesSignal.set(
      SelectableListUseCase.initializeSelection(this.workspaceEntriesSignal()),
    );
  }

  selectNext(direction: SelectionDirection): void {
    this.workspaceEntriesSignal.set(
      SelectableListUseCase.selectNext(
        this.workspaceEntriesSignal(),
        direction,
        (activeWorkspaceId, nextDirection) =>
          resolveNextNavigationTarget({
            items: this.navigationItemsProvider?.() ?? [],
            activeId: activeWorkspaceId,
            direction: nextDirection,
            wrap: true,
          }) ?? undefined,
      ),
    );
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
    const selectedWorkspaceId = SelectableListUseCase.getSelectedId(this.workspaceEntriesSignal());
    if (!selectedWorkspaceId) {
      return;
    }
    await this.workspaceHostPort.restoreWorkspace(selectedWorkspaceId);
  }

  async restoreWorkspace(workspaceId: string): Promise<void> {
    await this.workspaceHostPort.restoreWorkspace(workspaceId);
  }

  async closeWorkspace(workspaceId: string): Promise<void> {
    const shouldProceed = await this.workspaceCloseGuard.confirmCloseWorkspace(
      "close this workspace",
      workspaceId,
    );
    if (!shouldProceed) {
      return;
    }

    await this.workspaceHostPort.closeWorkspace(workspaceId);
  }

  async reorderWorkspaces(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void> {
    await this.workspaceHostPort.reorderWorkspaces(sourceWorkspaceId, targetWorkspaceId);
  }

  async persistWorkspaceOrder(): Promise<void> {
    await this.workspaceHostPort.persistWorkspaceOrder();
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
}
