export interface SideMenuFeatureDefinitionContract<
  TComponent = unknown,
  TIcon = string,
  TActionName = string,
> {
  readonly label: string;
  readonly icon: TIcon;
  readonly actionName: TActionName;
  readonly component: TComponent;
  readonly configPath: string;
  readonly pinned?: boolean;
}
