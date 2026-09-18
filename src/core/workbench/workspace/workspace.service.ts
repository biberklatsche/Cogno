import { computed, Injectable, Signal, signal } from "@angular/core";
import { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";
import {
  SelectableItemState,
  SelectableListUseCase,
  SelectionDirection,
  WorkspaceEntryContract,
} from "@cogno/shared/domain";
import { ConfirmDialogComponent, ConfirmDialogData, DialogService } from "@cogno/shared/ui";
import {
  DirectionalNavigationItem,
  resolveNextNavigationTarget,
} from "@cogno/shared/ui/common/navigation/directional-navigation.engine";
import { WorkspaceEditDialogComponent } from "./workspace-edit-dialog.component";
import { WorkspaceHostApplicationService } from "./workspace-host-application.service";

export type WorkspaceEntryViewModel = WorkspaceEntryContract & SelectableItemState<string>;

/**
 * What the workspace panel talks to. Its own part is the keyboard selection,
 * the edit dialogs and the "terminals are busy" confirmation before closing;
 * the rest goes straight to the application service.
 */
@Injectable({ providedIn: "root" })
export class WorkspaceService {
  private readonly selectedWorkspaceId = signal<string | undefined>(undefined);
  private navigationItemsProvider?: () => ReadonlyArray<DirectionalNavigationItem<string>>;

  /** The entries with the selection: the chosen one, else the active, else the first. */
  readonly workspaceEntries: Signal<WorkspaceEntryViewModel[]> = computed(() => {
    const entries = this.workspaces.workspaceEntries();
    const chosenId = this.selectedWorkspaceId();
    const selectedId = entries.some((entry) => entry.id === chosenId)
      ? chosenId
      : (entries.find((entry) => entry.isActive) ?? entries.at(0))?.id;
    return entries.map((entry) => ({ ...entry, isSelected: entry.id === selectedId }));
  });

  constructor(
    private readonly workspaces: WorkspaceHostApplicationService,
    private readonly terminalBusyStateService: TerminalBusyStateService,
    private readonly dialogService: DialogService,
  ) {}

  selectNext(direction: SelectionDirection): void {
    const entries = SelectableListUseCase.selectNext(
      this.workspaceEntries(),
      direction,
      (activeWorkspaceId, nextDirection) =>
        resolveNextNavigationTarget({
          items: this.navigationItemsProvider?.() ?? [],
          activeId: activeWorkspaceId,
          direction: nextDirection,
          wrap: true,
        }) ?? undefined,
    );
    this.selectedWorkspaceId.set(SelectableListUseCase.getSelectedId(entries));
  }

  registerNavigationItemsProvider(
    provider: () => ReadonlyArray<DirectionalNavigationItem<string>>,
  ): void {
    this.navigationItemsProvider = provider;
  }

  unregisterNavigationItemsProvider(
    provider: () => ReadonlyArray<DirectionalNavigationItem<string>>,
  ): void {
    if (this.navigationItemsProvider === provider) {
      this.navigationItemsProvider = undefined;
    }
  }

  async restoreSelectedWorkspace(): Promise<void> {
    const selectedWorkspaceId = SelectableListUseCase.getSelectedId(this.workspaceEntries());
    if (selectedWorkspaceId) {
      await this.workspaces.restoreWorkspaceById(selectedWorkspaceId);
    }
  }

  restoreWorkspace(workspaceId: string): Promise<void> {
    return this.workspaces.restoreWorkspaceById(workspaceId);
  }

  saveWorkspace(workspaceId: string): Promise<void> {
    return this.workspaces.saveWorkspace(workspaceId);
  }

  /** Deletes the workspace unless the user keeps it because terminals are busy. */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const shouldProceed =
      await this.terminalBusyStateService.confirmProceedIfNoBusyTerminalsInWorkspace(
        "delete this workspace",
        workspaceId,
      );
    if (shouldProceed) {
      await this.workspaces.deleteWorkspace(workspaceId);
    }
  }

  reorderWorkspaces(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void> {
    return this.workspaces.reorderWorkspaces(sourceWorkspaceId, targetWorkspaceId);
  }

  persistWorkspaceOrder(): Promise<void> {
    return this.workspaces.persistWorkspaceOrder();
  }

  /** Deletes what session restore has stored, after asking. */
  async clearRestoreData(): Promise<void> {
    const dialogRef = this.dialogService.open<ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      title: "Delete restore data",
      data: {
        message:
          "Delete the saved session? The terminals that are open now stay as they are; the next launch starts fresh.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
      },
      hasBackdrop: true,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });
    const confirmed = await new Promise<boolean>((resolve) => {
      const closeDialog = dialogRef.close.bind(dialogRef);
      dialogRef.close = (result?: boolean) => {
        resolve(result ?? false);
        closeDialog(result);
      };
    });
    if (confirmed) {
      await this.workspaces.clearRestoreData();
    }
  }

  /** Closes the workspace unless the user keeps it because terminals are busy. */
  async closeWorkspace(workspaceId: string): Promise<void> {
    const shouldProceed =
      await this.terminalBusyStateService.confirmProceedIfNoBusyTerminalsInWorkspace(
        "close this workspace",
        workspaceId,
      );
    if (shouldProceed) {
      await this.workspaces.closeWorkspace(workspaceId);
    }
  }

  openCreateWorkspaceDialog(): void {
    this.dialogService.open(WorkspaceEditDialogComponent, {
      title: "Create workspace",
      width: "420px",
      showCloseButton: true,
      data: this.workspaces.createWorkspaceDraft(),
    });
  }

  openEditWorkspaceDialog(workspaceId: string): void {
    const workspace = this.workspaces.getWorkspaceById(workspaceId);
    if (!workspace) {
      return;
    }
    this.dialogService.open(WorkspaceEditDialogComponent, {
      title: `Edit ${workspace.name}`,
      width: "420px",
      showCloseButton: true,
      data: { ...workspace },
    });
  }
}
