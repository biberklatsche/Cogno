export const defaultWorkspaceIdContract = "WS-DEFAULT";

export interface WorkspaceEntryContract {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly isDirty?: boolean;
  readonly isActive?: boolean;
  readonly isOpen?: boolean;
  /** Auto-save feedback for session restore (step 27g); unset until first autosave. */
  readonly autoSaveStatus?: "saving" | "saved";
  readonly autoSavedAt?: number;
}
