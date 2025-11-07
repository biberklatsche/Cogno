import {ShellType} from "../../config/+models/config.types";
import {TabId} from '../../workspace/+model/workspace';

export type TabList = TabUi[];

export type Tab = {
    id: TabId;
    title: string;
    isActive: boolean;
    activeShellType: ShellType | 'unknown';
}

export type TabUi = Tab & {
    showRename?: boolean;
}
