import { DestroyRef, Inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { workspaceHostPortToken } from "@cogno/app/app-host/app-host.tokens";
import { WorkspaceEntryContract, WorkspaceHostPortContract } from "@cogno/core-api";
import { ActionFired, ActionFiredEvent } from "../action/action.models";
import { AppBus } from "../app-bus/app-bus";

@Injectable({ providedIn: "root" })
export class WorkspaceShortcutActionService {
  private static readonly indexedShortcutLimit = 9;
  private workspaceEntries: ReadonlyArray<WorkspaceEntryContract> = [];

  constructor(
    private readonly appBus: AppBus,
    @Inject(workspaceHostPortToken)
    private readonly workspaceHostPort: WorkspaceHostPortContract,
    destroyRef: DestroyRef,
  ) {
    this.workspaceHostPort.workspaceEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((workspaceEntries) => {
        this.workspaceEntries = workspaceEntries;
      });

    this.appBus.on$(ActionFired.listener())
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: ActionFiredEvent) => {
        if (!event.payload) {
          return;
        }

        if (event.payload === "select_workspace_default") {
          const defaultWorkspaceEntry = this.workspaceEntries[0];
          if (defaultWorkspaceEntry) {
            void this.workspaceHostPort.restoreWorkspace(defaultWorkspaceEntry.id);
          }

          event.performed = !event.trigger?.all;
          event.defaultPrevented = true;
          return;
        }

        const workspaceIndex = this.resolveShortcutIndex(event.payload, "select_workspace_");
        if (workspaceIndex === undefined) {
          return;
        }

        const workspaceEntry = this.workspaceEntries[workspaceIndex];
        if (workspaceEntry) {
          void this.workspaceHostPort.restoreWorkspace(workspaceEntry.id);
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

