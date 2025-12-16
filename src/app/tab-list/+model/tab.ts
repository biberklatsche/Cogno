import {HexColor, ShellType} from "../../config/+models/config.types";
import {TabId} from '../../workspace/+model/workspace';
import {ColorName} from "../../common/color/color";

export type TabList = Tab[];

export type Tab = {
    color?: ColorName;
    id: TabId;
    title: string;
    isActive: boolean;
    activeShellType: ShellType | 'unknown';
}
