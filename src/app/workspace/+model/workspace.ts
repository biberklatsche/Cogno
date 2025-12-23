import {ShellConfigPosition} from "../../config/+models/config.types";
import {ColorName} from "../../common/color/color";
import {TerminalId} from "../../grid-list/+model/model";


export type TabId = string;

export type WorkspaceConfig = {
    name?: string;
    color?: ColorName;
    grids: GridConfig[];
    tabs: TabConfig[];
}

export type TabConfig = {
    tabId: TabId;
    isActive?: boolean;
    color?: ColorName;
    title?: string;
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
    TerminalId?: TerminalId;
    splitDirection?: never;
    ratio?: never;
    child1?: never;
    child2?: never;
    shellConfigPosition?: ShellConfigPosition;
    workingDir?: string;
}

export type SplitDirection = 'horizontal' | 'vertical';

