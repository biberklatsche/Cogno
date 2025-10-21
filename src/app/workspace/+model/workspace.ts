import {ShellConfigPosition} from "../../config/+models/config";


export type TabId = string;

export type WorkspaceConfig = {
    name?: string;
    color?: string;
    panes: PaneConfig[];
}

export type PaneConfig = {
    id: TabId;
    node: NodeConfig;
}

export type NodeConfig =
    | SplitNode
    | LeafNode;

export interface SplitNode {
    splitDirection: SplitDirection;
    ratio: number;
    leftChild: NodeConfig;
    rightChild: NodeConfig;
    shellConfig?: never;
}

export interface LeafNode {
    splitDirection?: never;
    ratio?: never;
    child1?: never;
    child2?: never;
    shellConfig: ShellConfigPosition;
}

export type SplitDirection = 'horizontal' | 'vertical';

