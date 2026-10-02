import { Injector, Type } from "@angular/core";
import { Icon } from "@cogno/shared/ui";
import { SideMenuFeatureHandleContract } from "./side-menu-feature-handle";
import { SideMenuFeatureLifecycleContract } from "./side-menu-feature-lifecycle";

export type SideMenuFeatureLifecycleFactory = (
  injector: Injector,
  sideMenuFeatureHandle: SideMenuFeatureHandleContract<Icon>,
) => SideMenuFeatureLifecycleContract;

/**
 * One entry in the side menu: what the app shows (title, icon, order, the
 * action that opens it) and what the feature provides (the panel component,
 * loaded lazily, and its lifecycle).
 */
export interface SideMenuFeatureDefinitionContract<TActionName = string> {
  readonly id: string;
  readonly title: string;
  readonly icon: Icon;
  readonly order: number;
  readonly actionName: TActionName;
  readonly configPath: string;
  readonly pinned?: boolean;
  readonly targetComponent: Type<unknown> | (() => Promise<Type<unknown>>);
  readonly createLifecycle?: SideMenuFeatureLifecycleFactory;
  readonly isAvailable?: (configuration: Record<string, unknown>) => boolean;
}
