import {ShellType} from "../../config/+models/config";

export type Tab = {
    id: string;
    title: string;
    shellType: ShellType;
    isSelected: boolean;
}