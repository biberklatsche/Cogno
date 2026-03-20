import { DestroyRef, Inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  defaultWorkspaceIdContract,
  WorkspaceEntryContract,
  WorkspaceHostPortContract,
  workspaceHostPortToken,
} from "@cogno/core-sdk";
import { AppBus } from "@cogno/app/app-bus/app-bus";
import { SelectedWorkspacePayload } from "./+bus/events";

@Injectable({ providedIn: "root" })
export class WorkspaceBusBridgeService {
  constructor(
    @Inject(workspaceHostPortToken)
    private readonly workspaceHostPort: WorkspaceHostPortContract,
    private readonly appBus: AppBus,
    destroyRef: DestroyRef,
  ) {
    this.workspaceHostPort.workspaceEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((workspaceEntries) => {
        this.publishSelectedWorkspaceChanged(workspaceEntries);
      });
  }

  private publishSelectedWorkspaceChanged(workspaceEntries: ReadonlyArray<WorkspaceEntryContract>): void {
    const activeWorkspaceEntry = workspaceEntries.find((workspaceEntry) => workspaceEntry.isActive) ?? workspaceEntries[0];
    const selectedWorkspacePayload: SelectedWorkspacePayload | undefined =
      activeWorkspaceEntry && activeWorkspaceEntry.id !== defaultWorkspaceIdContract
      ? {
          id: activeWorkspaceEntry.id,
          name: activeWorkspaceEntry.name,
          color: activeWorkspaceEntry.color,
        }
      : undefined;

    this.appBus.publish({
      type: "SelectedWorkspaceChanged",
      payload: selectedWorkspacePayload,
    });
  }
}
