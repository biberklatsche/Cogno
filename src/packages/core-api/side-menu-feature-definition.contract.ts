import { Icon } from "./icon.contract";

export interface SideMenuFeatureDefinitionContract<TIcon = Icon, TActionName = string> {
  readonly id: string;
  readonly title: string;
  readonly icon: TIcon;
  readonly order: number;
  readonly actionName: TActionName;
  readonly configPath: string;
  readonly pinned?: boolean;
}
