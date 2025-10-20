import {BinaryNode} from "../../common/tree/binary-tree";
import {ShellConfig} from "../../config/+models/config";

export type Grid = {
    tree: BinaryNode<Pane>;
}

export type Pane = {
    splitDirection?: SplitDirection;
    ratio?: number;
    terminalData?: TerminalData;
}

export type SplitDirection = 'horizontal' | 'vertical';

export type TerminalData = {
    shellConfig: ShellConfig;
}
