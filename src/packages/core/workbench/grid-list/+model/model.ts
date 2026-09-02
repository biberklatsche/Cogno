import { BinaryTree, TabId } from "@cogno/shared/domain";
import { TerminalId } from "@cogno/shared/ports";

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
