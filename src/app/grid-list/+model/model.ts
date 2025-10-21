import {TabId} from "../../workspace/+model/workspace";
import {BinaryTree} from "../../common/tree/binary-tree";
import {ShellConfigPosition} from "../../config/+models/config";

export type GridList = Record<TabId, Grid>;

export type TerminalId = string;

export interface Grid {
    id: TabId;
    tree: BinaryTree<Pane>;
}

export type Pane = {
    splitDirection?: SplitDirection;
    ratio?: number;
    shellConfigPosition?: ShellConfigPosition;
    terminalId?: TerminalId;
}

export type SplitDirection = 'horizontal' | 'vertical';

