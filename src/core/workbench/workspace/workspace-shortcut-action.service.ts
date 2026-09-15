import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { CoreActionName } from "@cogno/core/workbench/actions/catalog";
import { WorkspaceEntryContract } from "@cogno/shared/domain";
import { WorkspaceHostService } from "./workspace-host.service";

@Injectable({ providedIn: "root" })
export class WorkspaceShortcutActionService {
  private static readonly indexedShortcutLimit = 9;
  private workspaceEntries: ReadonlyArray<WorkspaceEntryContract> = [];

  constructor(
    actions: ActionHandlers,
    private readonly workspaceHostPort: WorkspaceHostService,
    destroyRef: DestroyRef,
  ) {
    this.workspaceHostPort.workspaceEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((workspaceEntries) => {
        this.workspaceEntries = workspaceEntries;
      });

    // The default workspace is the first entry; the numbered shortcuts index the
    // rest by position.
    actions.handle("select_workspace_default", () => this.restore(0));
    for (let index = 1; index <= WorkspaceShortcutActionService.indexedShortcutLimit; index++) {
      actions.handle(`select_workspace_${index}` as CoreActionName, () => this.restore(index));
    }
  }

  private restore(entryIndex: number): void {
    const workspaceEntry = this.workspaceEntries[entryIndex];
    if (workspaceEntry) {
      void this.workspaceHostPort.restoreWorkspace(workspaceEntry.id);
    }
  }
}
