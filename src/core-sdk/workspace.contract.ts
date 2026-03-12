import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";

export const defaultWorkspaceIdContract = "WS-DEFAULT";

export interface WorkspaceEntryContract {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly autosave?: boolean;
  readonly isActive?: boolean;
}

export interface WorkspaceHostPortContract {
  readonly workspaceEntries$: Observable<ReadonlyArray<WorkspaceEntryContract>>;
  restoreWorkspace(workspaceId: string): Promise<void>;
  openCreateWorkspaceDialog(): void;
  openEditWorkspaceDialog(workspaceId: string): void;
  deleteWorkspace(workspaceId: string): Promise<void>;
}

export const workspaceHostPortToken = new InjectionToken<WorkspaceHostPortContract>(
  "workspace-host-port-token",
);
