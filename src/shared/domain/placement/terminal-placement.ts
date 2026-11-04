/** Where a terminal sits in the workbench: which workspace, which tab, in display order. */
export type TerminalPlacement = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  /** Colour name of the workspace, the default one when it has none. */
  readonly workspaceColor: string;
  /** Index of the workspace in the workspace list, as the panel shows it. */
  readonly workspacePosition: number;
  /** The tab as its header shows it: the user's name for it, else its system title. */
  readonly tabTitle: string;
  /** Colour name of the tab, absent when the user gave it none. */
  readonly tabColor?: string;
  /** Position of the tab in its workspace's tab order; a stack's members count in its place. */
  readonly tabIndex: number;
};
