import { TabId } from "@cogno/core-api";
import { ColorName } from "../../common/color/color";
import { ShellType } from "../../config/+models/config";

export type TabList = Tab[];

export type Tab = {
  color?: ColorName;
  id: TabId;
  systemTitle: string;
  userTitle?: string;
  isActive: boolean;
  isBusy?: boolean;
  activeShellType: ShellType | "unknown";
};
