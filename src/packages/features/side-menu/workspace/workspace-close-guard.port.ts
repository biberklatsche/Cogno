import { WorkspaceCloseGuardContract } from "@cogno/features/side-menu/ports";

export type { WorkspaceCloseGuardContract };

export abstract class WorkspaceCloseGuard implements WorkspaceCloseGuardContract {
  abstract confirmCloseWorkspace(actionLabel: string, workspaceId: string): Promise<boolean>;
}
