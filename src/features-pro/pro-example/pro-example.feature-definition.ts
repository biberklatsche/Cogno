import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { ProExampleSideComponent } from "./pro-example-side.component";

export const proExampleFeatureId = "pro-example";

export const proExampleSideMenuFeatureDefinition = {
  id: proExampleFeatureId,
  title: "Pro Example",
  icon: "mdiBellBadge",
  order: 15,
  actionName: "open_pro_example",
  targetComponent: ProExampleSideComponent,
  configPath: "pro_example",
} as const satisfies SideMenuFeatureDefinitionContract<Type<unknown>, string, string>;
