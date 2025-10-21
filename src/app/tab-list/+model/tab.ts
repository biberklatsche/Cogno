import {ShellType} from "../../config/+models/config";

export type Tab = {
    id: string;
    title: string;
    isSelected: boolean;
    activeShellType: ShellType | 'unknown';
}
