import { TabId } from "@cogno/core/workbench/grid-layout";
import { BinaryTree } from "@cogno/core/workbench/grid-list/binary-tree";
import { TerminalId } from "@cogno/shared/domain";

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
