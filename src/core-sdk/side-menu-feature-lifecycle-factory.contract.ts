import { Injector } from "@angular/core";
import { SideMenuFeatureHandleContract } from "./side-menu-feature-handle.contract";
import { SideMenuFeatureLifecycleContract } from "./side-menu-feature-lifecycle.contract";

export type SideMenuFeatureLifecycleFactoryContract<TIcon = string> = (
  injector: Injector,
  sideMenuFeatureHandle: SideMenuFeatureHandleContract<TIcon>,
) => SideMenuFeatureLifecycleContract;
