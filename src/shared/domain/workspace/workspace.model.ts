import {
  PersistedGridConfigurationContract,
  PersistedTabConfigurationContract,
  WorkspaceIdentifierContract,
} from "../grid-layout";

/** Colour name a workspace shows while it has none of its own. */
export const DEFAULT_WORKSPACE_COLOR = "green";

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

export interface WorkspaceState extends WorkspaceConfiguration {
  isSelected: boolean;
  isDirty?: boolean;
  /** The last session-restore autosave failed (step 27g). */
  autoSaveFailed?: boolean;
}
