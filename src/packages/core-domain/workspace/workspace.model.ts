import {
  PersistedGridConfigurationContract,
  PersistedTabConfigurationContract,
  WorkspaceIdentifierContract,
} from "@cogno/core-api";

export interface WorkspaceConfiguration {
  id: WorkspaceIdentifierContract;
  name: string;
  color?: string;
  grids: PersistedGridConfigurationContract[];
  tabs: PersistedTabConfigurationContract[];
  position?: number;
  isActive?: boolean;
  autosave?: boolean;
}

export interface WorkspaceTerminalSession {
  terminalId: string;
  sessionData: string;
  updatedAt?: string;
}

export interface WorkspaceState extends WorkspaceConfiguration {
  isSelected: boolean;
  isOpen?: boolean;
}
