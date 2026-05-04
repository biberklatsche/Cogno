import { InjectionToken, Injector, Type } from "@angular/core";
import { ActionName } from "@cogno/app/action/action.models";
import {
  SideMenuFeatureDefinitionContract,
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/core-api";
import { Icon } from "@cogno/core-ui";

export type SideMenuFeatureLifecycleFactory = (
  injector: Injector,
  sideMenuFeatureHandle: SideMenuFeatureHandleContract<Icon>,
) => SideMenuFeatureLifecycleContract;

export interface SideMenuFeatureDefinition
  extends SideMenuFeatureDefinitionContract<Icon, ActionName> {
  readonly targetComponent: Type<unknown>;
  readonly createLifecycle?: SideMenuFeatureLifecycleFactory;
  readonly isAvailable?: (configuration: Record<string, unknown>) => boolean;
}

export const sideMenuFeatureDefinitionsToken = new InjectionToken<
  ReadonlyArray<SideMenuFeatureDefinition>
>("side-menu-feature-definitions");
