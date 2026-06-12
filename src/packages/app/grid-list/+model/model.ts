import { TabId, TerminalId } from "@cogno/core-api";
import { BinaryTree } from "@cogno/core-domain";

export type { TerminalId };

export type GridList = Record<TabId, Grid>;

export interface Grid {
  tabId: TabId;
  tree: BinaryTree<Pane>;
}

export type Pane = {
  splitDirection?: SplitDirection;
  ratio?: number;
  shellName?: string;
  workingDir?: string;
  title?: string;
  terminalId?: TerminalId;
  isFocused?: boolean;
};

export type SplitDirection = "horizontal" | "vertical";
