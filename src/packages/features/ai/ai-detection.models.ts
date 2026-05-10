import { InjectionToken } from "@angular/core";
import { AiProviderType } from "./ai.models";

export type DetectedAiProvider = {
  readonly id: string;
  readonly displayName: string;
  readonly type: AiProviderType;
  readonly baseUrl: string;
  readonly models: ReadonlyArray<string>;
};

export type AiDetectableProviderDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly type: AiProviderType;
  readonly defaultBaseUrl: string;
  readonly probeEndpoint: string;
  parseModels(responseBody: string): string[];
};

export const AI_DETECTABLE_PROVIDER_DEFINITIONS_TOKEN = new InjectionToken<
  readonly AiDetectableProviderDefinition[]
>("aiDetectableProviderDefinitions");
