export interface SideMenuFeatureDefinitionContract<TIcon = string, TActionName = string> {
  readonly id: string;
  readonly title: string;
  readonly icon: TIcon;
  readonly order: number;
  readonly actionName: TActionName;
  readonly configPath: string;
  readonly pinned?: boolean;
}
