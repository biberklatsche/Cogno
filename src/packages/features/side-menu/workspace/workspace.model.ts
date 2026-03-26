import {
  PersistedGridConfigurationContract,
  PersistedTabConfigurationContract,
  WorkspaceIdentifierContract,
} from "@cogno/core-sdk";

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
