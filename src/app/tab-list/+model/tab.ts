import {ShellType} from "../../config/+models/config";
import {TabId} from '../../workspace/+model/workspace';

export type TabList = Tab[];

export type Tab = {
    id: TabId;
    title: string;
    isActive: boolean;
    activeShellType: ShellType | 'unknown';
}
