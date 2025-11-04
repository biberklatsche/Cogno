import {ShellType} from "../../config/+models/config.types";
import {TabId} from '../../workspace/+model/workspace';

export type TabList = Tab[];

export type Tab = {
    id: TabId;
    title: string;
    isActive: boolean;
    activeShellType: ShellType | 'unknown';
}
