import {ShellType} from "../../config/+models/config";

export type Tab = {
    id: string;
    title: string;
    isActive: boolean;
    activeShellType: ShellType | 'unknown';
}
