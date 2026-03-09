export interface SideMenuFeatureDefinitionContract<
  TComponent = unknown,
  TIcon = string,
  TActionName = string,
> {
  readonly id: string;
  readonly title: string;
  readonly icon: TIcon;
  readonly order: number;
  readonly actionName: TActionName;
  readonly targetComponent: TComponent;
  readonly configPath: string;
  readonly pinned?: boolean;
}
