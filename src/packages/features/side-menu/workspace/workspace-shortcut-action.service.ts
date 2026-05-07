import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActionDispatcher, WorkspaceEntryContract, WorkspaceHostPort } from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class WorkspaceShortcutActionService {
  private static readonly indexedShortcutLimit = 9;
  private workspaceEntries: ReadonlyArray<WorkspaceEntryContract> = [];

  constructor(
    private readonly actionDispatcher: ActionDispatcher,
    private readonly workspaceHostPort: WorkspaceHostPort,
    destroyRef: DestroyRef,
  ) {
    this.workspaceHostPort.workspaceEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((workspaceEntries) => {
        this.workspaceEntries = workspaceEntries;
      });

    this.actionDispatcher
      .onAction$("select_workspace_default")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        const defaultWorkspaceEntry = this.workspaceEntries[0];
        if (defaultWorkspaceEntry) {
          void this.workspaceHostPort.restoreWorkspace(defaultWorkspaceEntry.id);
        }
      });

    for (let index = 1; index <= WorkspaceShortcutActionService.indexedShortcutLimit; index++) {
      const capturedIndex = index;
      this.actionDispatcher
        .onAction$(`select_workspace_${capturedIndex}`)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(() => {
          const workspaceEntry = this.workspaceEntries[capturedIndex];
          if (workspaceEntry) {
            void this.workspaceHostPort.restoreWorkspace(workspaceEntry.id);
          }
        });
    }
  }
}
