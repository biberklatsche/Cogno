import { ApplicationFeatureCollectionContract } from "./application-feature-collection.contract";

export interface ApplicationProductContract<TIcon = string, TActionName = string> {
  readonly featureCollection: ApplicationFeatureCollectionContract<TIcon, TActionName>;
}

export abstract class ApplicationProduct<TIcon = string, TActionName = string>
  implements ApplicationProductContract<TIcon, TActionName>
{
  abstract readonly featureCollection: ApplicationFeatureCollectionContract<TIcon, TActionName>;
}
