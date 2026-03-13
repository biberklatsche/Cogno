export type TabIdentifierContract = string;
export type WorkspaceIdentifierContract = string;

export type SplitDirection = "horizontal" | "vertical";

export interface PersistedPaneConfigurationContract {
  splitDirection?: SplitDirection;
  ratio?: number;
  leftChild?: PersistedPaneConfigurationContract;
  rightChild?: PersistedPaneConfigurationContract;
  shellName?: string;
  workingDir?: string;
  terminalId?: string;
}

export interface PersistedTabConfigurationContract {
  readonly tabId: TabIdentifierContract;
  readonly isActive?: boolean;
  readonly color?: string;
  readonly title?: string;
  readonly isTitleLocked?: boolean;
}

export interface PersistedGridConfigurationContract {
  readonly tabId: TabIdentifierContract;
  readonly pane: PersistedPaneConfigurationContract;
}

export type TerminalConfig = PersistedPaneConfigurationContract;
export type TabId = TabIdentifierContract;
export type WorkspaceId = WorkspaceIdentifierContract;
export type TabConfig = PersistedTabConfigurationContract;
export type GridConfig = PersistedGridConfigurationContract;
export type PaneConfig = PersistedPaneConfigurationContract;

export interface TerminalSession {
  terminalId: string;
  sessionData: string;
  updatedAt?: string;
}
