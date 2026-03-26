import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActionFired, ActionFiredEvent } from "../action/action.models";
import { AppBus } from "../app-bus/app-bus";
import { WorkspaceService } from "@cogno/features/side-menu/workspace/workspace.service";

@Injectable({ providedIn: "root" })
export class WorkspaceShortcutActionService {
  private static readonly indexedShortcutLimit = 9;

  constructor(
    private readonly appBus: AppBus,
    private readonly workspaceService: WorkspaceService,
    destroyRef: DestroyRef,
  ) {
    this.appBus.on$(ActionFired.listener())
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: ActionFiredEvent) => {
        if (!event.payload) {
          return;
        }

        if (event.payload === "select_workspace_default") {
          const defaultWorkspaceEntry = this.workspaceService.workspaceEntries()[0];
          if (defaultWorkspaceEntry) {
            void this.workspaceService.restoreWorkspace(defaultWorkspaceEntry.id);
          }

          event.performed = !event.trigger?.all;
          event.defaultPrevented = true;
          return;
        }

        const workspaceIndex = this.resolveShortcutIndex(event.payload, "select_workspace_");
        if (workspaceIndex === undefined) {
          return;
        }

        const workspaceEntry = this.workspaceService.workspaceEntries()[workspaceIndex];
        if (workspaceEntry) {
          void this.workspaceService.restoreWorkspace(workspaceEntry.id);
        }

        event.performed = !event.trigger?.all;
        event.defaultPrevented = true;
      });
  }

  private resolveShortcutIndex(actionName: string, prefix: string): number | undefined {
    if (!actionName.startsWith(prefix)) {
      return undefined;
    }

    const index = Number.parseInt(actionName.slice(prefix.length), 10);
    if (Number.isNaN(index) || index < 1 || index > WorkspaceShortcutActionService.indexedShortcutLimit) {
      return undefined;
    }

    return index;
  }
}
