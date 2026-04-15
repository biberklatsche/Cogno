export interface WorkspaceCloseGuardContract {
  confirmCloseWorkspace(actionLabel: string, workspaceId: string): Promise<boolean>;
}

export abstract class WorkspaceCloseGuard implements WorkspaceCloseGuardContract {
  abstract confirmCloseWorkspace(actionLabel: string, workspaceId: string): Promise<boolean>;
}
