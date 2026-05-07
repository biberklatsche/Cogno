export interface WorkspaceCloseGuardContract {
  confirmCloseWorkspace(actionLabel: string, workspaceId: string): Promise<boolean>;
}
