import { Injectable, Type } from "@angular/core";
import { CoreHostBootstrapHost, SideMenuFeatureRegistryHost } from "@cogno/core-host";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { ActionName } from "../action/action.models";
import { Icon } from "../icons/+model/icon";
import { sideMenuFeatureDefinitions } from "../menu/side-menu/+state/side-menu-feature-definitions";
import { openFeatureSideMenuFeatureDefinitions } from "@cogno/open-features";
import { proFeatureSideMenuFeatureDefinitions } from "@cogno/pro-features";

@Injectable({ providedIn: "root" })
export class CoreHostWiringService {
  private static singletonInstance: CoreHostWiringService | undefined;

  private readonly sideMenuFeatureRegistryHost = new SideMenuFeatureRegistryHost<
    Type<unknown>,
    Icon,
    ActionName
  >();

  private readonly coreHostBootstrapHost = new CoreHostBootstrapHost<
    Type<unknown>,
    Icon,
    ActionName
  >(this.sideMenuFeatureRegistryHost);

  constructor() {
    this.coreHostBootstrapHost.registerSideMenuFeatures([
      ...sideMenuFeatureDefinitions,
      ...openFeatureSideMenuFeatureDefinitions,
      ...proFeatureSideMenuFeatureDefinitions,
    ]);
    CoreHostWiringService.singletonInstance = this;
  }

  static getInstance(): CoreHostWiringService {
    if (CoreHostWiringService.singletonInstance === undefined) {
      CoreHostWiringService.singletonInstance = new CoreHostWiringService();
    }
    return CoreHostWiringService.singletonInstance;
  }

  getRequiredSideMenuFeatureDefinitionById(
    sideMenuFeatureDefinitionId: string,
  ): SideMenuFeatureDefinitionContract<Type<unknown>, Icon, ActionName> {
    const sideMenuFeatureDefinition = this.sideMenuFeatureRegistryHost.getSideMenuFeatureDefinitionById(
      sideMenuFeatureDefinitionId,
    );
    if (sideMenuFeatureDefinition === undefined) {
      throw new Error(`Unknown side menu feature definition id: ${sideMenuFeatureDefinitionId}`);
    }
    return sideMenuFeatureDefinition;
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<Type<unknown>, Icon, ActionName>
  > {
    return this.sideMenuFeatureRegistryHost.getSideMenuFeatureDefinitions();
  }
}
