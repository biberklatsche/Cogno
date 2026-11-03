type TabIdentifierContract = string;
type StackIdentifierContract = string;
export type WorkspaceIdentifierContract = string;

type SplitDirection = "horizontal" | "vertical";

export interface PersistedPaneConfigurationContract {
  splitDirection?: SplitDirection;
  ratio?: number;
  leftChild?: PersistedPaneConfigurationContract;
  rightChild?: PersistedPaneConfigurationContract;
  shellName?: string;
  workingDir?: string;
  title?: string;
  terminalId?: string;
}

export interface PersistedTabConfigurationContract {
  readonly tabId: TabIdentifierContract;
  readonly isActive?: boolean;
  readonly color?: string;
  readonly systemTitle?: string;
  readonly userTitle?: string;
  /** The stack this tab is a member of; members of one stack are stored next to each other. */
  readonly stackId?: StackIdentifierContract;
}

export interface PersistedTabStackConfigurationContract {
  readonly stackId: StackIdentifierContract;
  readonly name?: string;
  readonly color?: string;
  /** The member the collapsed stack stands for. */
  readonly currentTabId?: TabIdentifierContract;
  /** Shown with its members, or as its head alone. */
  readonly isExpanded?: boolean;
}

export interface PersistedGridConfigurationContract {
  readonly tabId: TabIdentifierContract;
  readonly pane: PersistedPaneConfigurationContract;
}

export type TerminalConfig = PersistedPaneConfigurationContract;
export type TabId = TabIdentifierContract;
export type StackId = StackIdentifierContract;
export type WorkspaceId = WorkspaceIdentifierContract;
export type TabConfig = PersistedTabConfigurationContract;
export type TabStackConfig = PersistedTabStackConfigurationContract;
export type GridConfig = PersistedGridConfigurationContract;
export type PaneConfig = PersistedPaneConfigurationContract;
