import { WorkspaceCloseGuardContract } from "@cogno/core-api";

export type { WorkspaceCloseGuardContract };

export abstract class WorkspaceCloseGuard implements WorkspaceCloseGuardContract {
  abstract confirmCloseWorkspace(actionLabel: string, workspaceId: string): Promise<boolean>;
}
