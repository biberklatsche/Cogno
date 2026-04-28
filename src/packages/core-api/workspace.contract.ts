import { Observable } from "rxjs";

export const defaultWorkspaceIdContract = "WS-DEFAULT";

export interface WorkspaceEntryContract {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly isDirty?: boolean;
  readonly isActive?: boolean;
  readonly isOpen?: boolean;
}

export interface WorkspaceHostPortContract {
  readonly workspaceEntries$: Observable<ReadonlyArray<WorkspaceEntryContract>>;
  restoreWorkspace(workspaceId: string): Promise<void>;
  saveWorkspace(workspaceId: string): Promise<void>;
  closeWorkspace(workspaceId: string): Promise<void>;
  reorderWorkspaces(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void>;
  persistWorkspaceOrder(): Promise<void>;
  openCreateWorkspaceDialog(): void;
  openEditWorkspaceDialog(workspaceId: string): void;
  deleteWorkspace(workspaceId: string): Promise<void>;
}

export abstract class WorkspaceHostPort implements WorkspaceHostPortContract {
  abstract readonly workspaceEntries$: Observable<ReadonlyArray<WorkspaceEntryContract>>;
  abstract restoreWorkspace(workspaceId: string): Promise<void>;
  abstract saveWorkspace(workspaceId: string): Promise<void>;
  abstract closeWorkspace(workspaceId: string): Promise<void>;
  abstract reorderWorkspaces(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void>;
  abstract persistWorkspaceOrder(): Promise<void>;
  abstract openCreateWorkspaceDialog(): void;
  abstract openEditWorkspaceDialog(workspaceId: string): void;
  abstract deleteWorkspace(workspaceId: string): Promise<void>;
}
