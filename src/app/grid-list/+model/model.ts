import {TabId} from "../../workspace/+model/workspace";
import {BinaryTree} from "../../common/tree/binary-tree";
import {ShellConfigPosition} from "../../config/+models/config";

export type GridList = Record<TabId, Grid>;

export type TerminalId = string;

export interface Grid {
    tabId: TabId;
    tree: BinaryTree<Pane>;
}

export type Pane = {
    splitDirection?: SplitDirection;
    ratio?: number;
    shellConfigPosition?: ShellConfigPosition;
    workingDir?: string;
    terminalId?: string;
    isFocused?: boolean;
}

export type SplitDirection = 'horizontal' | 'vertical';

