import {MessageBase} from "../../app-bus/app-bus";
import {ShellType} from "../../config/+models/config";

export type TabConfig = {
    splitDirection: SplitDirection,
    color?: string,
    name?: string,
    shellType: ShellType,
    workingDirectory?: string,
    children?: TabConfig[],
}

export type SplitDirection = 'horizontal' | 'vertical';

export type AddTabsEvent = MessageBase<"AddTabsEvent", TabConfig>
