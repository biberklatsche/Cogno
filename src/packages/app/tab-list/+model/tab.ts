import { TabId } from "@cogno/shared/domain";
import { ColorName } from "../../common/color/color";
import { ShellType } from "../../config/+models/config";

export type TabList = Tab[];

export type Tab = {
  color?: ColorName;
  id: TabId;
  systemTitle: string;
  userTitle?: string;
  isActive: boolean;
  activeShellType: ShellType | "unknown";
};
