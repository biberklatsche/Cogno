import { TabId } from "@cogno/core-api";
import { BinaryTree } from "../../common/tree/binary-tree";

export type GridList = Record<TabId, Grid>;

export type TerminalId = string;

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
  terminalId?: string;
  isFocused?: boolean;
  isBusy?: boolean;
};

export type SplitDirection = "horizontal" | "vertical";
