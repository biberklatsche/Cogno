import {
  PersistedGridConfigurationContract,
  PersistedTabConfigurationContract,
  WorkspaceIdentifierContract,
} from "../grid-layout";

export interface WorkspaceConfiguration {
  id: WorkspaceIdentifierContract;
  name: string;
  color?: string;
  grids: PersistedGridConfigurationContract[];
  tabs: PersistedTabConfigurationContract[];
  position?: number;
  isActive?: boolean;
}

export interface WorkspaceTerminalSession {
  terminalId: string;
  sessionData: string;
  updatedAt?: string;
}

export type WorkspaceAutoSaveStatus = "saving" | "saved";

export interface WorkspaceState extends WorkspaceConfiguration {
  isSelected: boolean;
  isOpen?: boolean;
  isDirty?: boolean;
  /** Auto-save feedback for session restore (step 27g); unset until first autosave. */
  autoSaveStatus?: WorkspaceAutoSaveStatus;
  autoSavedAt?: number;
}
