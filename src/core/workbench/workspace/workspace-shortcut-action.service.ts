import { Injectable } from "@angular/core";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { SLOTS } from "@cogno/core/workbench/actions/catalog";
import { WorkspaceHostApplicationService } from "./workspace-host-application.service";

@Injectable({ providedIn: "root" })
export class WorkspaceShortcutActionService {
  constructor(
    actions: ActionHandlers,
    private readonly workspaces: WorkspaceHostApplicationService,
  ) {
    // The default workspace is the first entry; the numbered shortcuts index the
    // rest by position.
    actions.handle("select_workspace_default", () => this.restore(0));
    for (const slot of SLOTS) {
      actions.handle(`select_workspace_${slot}`, () => this.restore(slot));
    }
  }

  private restore(entryIndex: number): void {
    const workspaceEntry = this.workspaces.workspaceEntries()[entryIndex];
    if (workspaceEntry) {
      void this.workspaces.restoreWorkspaceById(workspaceEntry.id);
    }
  }
}
