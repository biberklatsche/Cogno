import { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { TabId } from "@cogno/shared/domain";
import { ColorName } from "@cogno/shared/support";

export type TabList = Tab[];

export type Tab = {
  color?: ColorName;
  id: TabId;
  systemTitle: string;
  userTitle?: string;
  isActive: boolean;
  activeShellType: ShellType | "unknown";
};
