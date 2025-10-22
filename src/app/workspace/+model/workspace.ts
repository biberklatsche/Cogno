import {ShellConfigPosition} from "../../config/+models/config";


export type TabId = string;

export type WorkspaceConfig = {
    name?: string;
    color?: string;
    grids: GridConfig[];
}

export type GridConfig = {
    tabId: TabId;
    pane: PaneConfig;
}

export type PaneConfig =
    | SplitNode
    | TerminalConfig;

export interface SplitNode {
    splitDirection: SplitDirection;
    ratio: number;
    leftChild: PaneConfig;
    rightChild: PaneConfig;
    shellConfig?: never;
}

export interface TerminalConfig {
    splitDirection?: never;
    ratio?: never;
    child1?: never;
    child2?: never;
    shellConfigPosition?: ShellConfigPosition;
    workingDir?: string;
}

export type SplitDirection = 'horizontal' | 'vertical';

