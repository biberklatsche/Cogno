export const defaultWorkspaceIdContract = "WS-DEFAULT";

export interface WorkspaceEntryContract {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly isDirty?: boolean;
  readonly isActive?: boolean;
  readonly isOpen?: boolean;
}
