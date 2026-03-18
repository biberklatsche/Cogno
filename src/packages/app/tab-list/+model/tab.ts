import {HexColor, ShellType} from "../../config/+models/config";
import {TabId} from "@cogno/core-sdk";
import {ColorName} from "../../common/color/color";

export type TabList = Tab[];

export type Tab = {
    color?: ColorName;
    id: TabId;
    title: string;
    isTitleLocked?: boolean;
    isActive: boolean;
    activeShellType: ShellType | 'unknown';
}
