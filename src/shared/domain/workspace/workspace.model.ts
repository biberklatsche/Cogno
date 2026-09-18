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
  /** Selected and shown; at most one workspace is active. */
  isActive?: boolean;
  /** Has a runtime (tabs, grids, sessions), on screen or in the background. */
  isOpen?: boolean;
}

export interface WorkspaceTerminalSession {
  terminalId: string;
  sessionData: string;
  updatedAt?: string;
}

export type WorkspaceAutoSaveStatus = "saving" | "saved";

export interface WorkspaceState extends WorkspaceConfiguration {
  isSelected: boolean;
  isDirty?: boolean;
  /** Auto-save feedback for session restore (step 27g); unset until first autosave. */
  autoSaveStatus?: WorkspaceAutoSaveStatus;
  autoSavedAt?: number;
}
