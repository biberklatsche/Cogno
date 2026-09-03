import { Injectable } from "@angular/core";
import { SideMenuActionNamesSource } from "@cogno/core/workbench/actions/side-menu-action-names.source";
import { AppWiringService } from "./app-wiring.service";

/** Hands the action catalogue the action names the side-menu features contribute. */
@Injectable({ providedIn: "root" })
export class SideMenuActionNamesFeatureSourceService extends SideMenuActionNamesSource {
  constructor(private readonly wiringService: AppWiringService) {
    super();
  }

  getSideMenuActionNames(): ReadonlyArray<string> {
    return this.wiringService
      .getSideMenuFeatureDefinitions()
      .map((sideMenuFeatureDefinition) => sideMenuFeatureDefinition.actionName);
  }
}
