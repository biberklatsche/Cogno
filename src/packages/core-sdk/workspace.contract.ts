import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";

export const defaultWorkspaceIdContract = "WS-DEFAULT";

export interface WorkspaceEntryContract {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly autosave?: boolean;
  readonly isActive?: boolean;
  readonly isOpen?: boolean;
}

export interface WorkspaceHostPortContract {
  readonly workspaceEntries$: Observable<ReadonlyArray<WorkspaceEntryContract>>;
  restoreWorkspace(workspaceId: string): Promise<void>;
  closeWorkspace(workspaceId: string): Promise<void>;
  reorderWorkspaces(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void>;
  persistWorkspaceOrder(): Promise<void>;
  openCreateWorkspaceDialog(): void;
  openEditWorkspaceDialog(workspaceId: string): void;
  deleteWorkspace(workspaceId: string): Promise<void>;
}

export const workspaceHostPortToken = new InjectionToken<WorkspaceHostPortContract>(
  "workspace-host-port-token",
);
