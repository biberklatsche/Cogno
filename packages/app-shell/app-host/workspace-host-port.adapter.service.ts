import { Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { map, Observable } from "rxjs";
import {
  WorkspaceEntryContract,
  WorkspaceHostPortContract,
} from "@cogno/core-sdk";
import { DialogService } from "../common/dialog";
import { WorkspaceEditDialogComponent } from "./workspace-edit-dialog.component";
import {
  WorkspaceConfigUi,
  WorkspaceHostApplicationService,
} from "./workspace-host-application.service";

@Injectable({ providedIn: "root" })
export class WorkspaceHostPortAdapterService implements WorkspaceHostPortContract {
  readonly workspaceEntries$: Observable<ReadonlyArray<WorkspaceEntryContract>>;

  constructor(
    private readonly workspaceHostApplicationService: WorkspaceHostApplicationService,
    private readonly dialogService: DialogService,
  ) {
    this.workspaceEntries$ = toObservable(this.workspaceHostApplicationService.workspaceList).pipe(
      map((workspaceList) =>
        workspaceList.map((workspaceConfigUi) => ({
          id: workspaceConfigUi.id,
          name: workspaceConfigUi.name,
          color: workspaceConfigUi.color,
          autosave: workspaceConfigUi.autosave,
          isActive: workspaceConfigUi.isActive,
        })),
      ),
    );
  }

  async restoreWorkspace(workspaceId: string): Promise<void> {
    const workspaceConfigUi = this.workspaceHostApplicationService.getWorkspaceById(workspaceId);
    if (!workspaceConfigUi) {
      return;
    }
    await this.workspaceHostApplicationService.restoreWorkspace(workspaceConfigUi);
  }

  openCreateWorkspaceDialog(): void {
    const workspaceDraft = this.workspaceHostApplicationService.createWorkspaceDraft();
    this.dialogService.open(WorkspaceEditDialogComponent, {
      title: "Create workspace",
      width: "420px",
      showCloseButton: true,
      data: workspaceDraft,
    });
  }

  openEditWorkspaceDialog(workspaceId: string): void {
    const workspaceConfigUi = this.workspaceHostApplicationService.getWorkspaceById(workspaceId);
    if (!workspaceConfigUi) {
      return;
    }
    this.dialogService.open(WorkspaceEditDialogComponent, {
      title: `Edit ${workspaceConfigUi.name}`,
      width: "420px",
      showCloseButton: true,
      data: { ...workspaceConfigUi } as WorkspaceConfigUi,
    });
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.workspaceHostApplicationService.deleteWorkspace(workspaceId);
  }
}
