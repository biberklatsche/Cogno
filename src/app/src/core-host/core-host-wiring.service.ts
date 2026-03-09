import { Injectable, Type } from "@angular/core";
import { CoreHostBootstrapHost, SideMenuFeatureRegistryHost } from "@cogno/core-host";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { ActionName } from "../action/action.models";
import { Icon } from "../icons/+model/icon";
import { terminalSearchFeatureDefinition } from "../terminal-search/terminal-search.feature-definition";

@Injectable({ providedIn: "root" })
export class CoreHostWiringService {
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
      terminalSearchFeatureDefinition,
    ]);
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<Type<unknown>, Icon, ActionName>
  > {
    return this.sideMenuFeatureRegistryHost.getSideMenuFeatureDefinitions();
  }
}
