import { Inject, Injectable, signal } from "@angular/core";
import { ApplicationConfigurationPort, HttpClientPort } from "@cogno/core-api";
import { getAiFeatureConfig, getRawProviderOverrides } from "./ai-config.utils";
import {
  AI_DETECTABLE_PROVIDER_DEFINITIONS_TOKEN,
  AiDetectableProviderDefinition,
  DetectedAiProvider,
} from "./ai-detection.models";
import { DetectedAiProvidersStore } from "./detected-ai-providers-store.service";

@Injectable({ providedIn: "root" })
export class AiProviderDetectionService {
  private readonly isDetecting = signal(false);

  constructor(
    @Inject(AI_DETECTABLE_PROVIDER_DEFINITIONS_TOKEN)
    private readonly definitions: readonly AiDetectableProviderDefinition[],
    private readonly configPort: ApplicationConfigurationPort,
    private readonly httpClient: HttpClientPort,
    private readonly store: DetectedAiProvidersStore,
  ) {}

  async detect(): Promise<void> {
    if (this.isDetecting()) return;

    const config = this.configPort.getConfiguration();
    const aiConfig = getAiFeatureConfig(config ?? {});

    if (aiConfig?.mode === "off") return;

    const rawOverrides = getRawProviderOverrides(config ?? {});

    this.isDetecting.set(true);
    this.store.setIsDetecting(true);
    try {
      const results = await Promise.all(
        this.definitions.map((def) => this.probe(def, rawOverrides)),
      );
      this.store.setDetected(results.filter((r): r is DetectedAiProvider => r !== null));
    } finally {
      this.isDetecting.set(false);
      this.store.setIsDetecting(false);
    }
  }

  private async probe(
    definition: AiDetectableProviderDefinition,
    existingProviders: Readonly<
      Record<string, { base_url?: string; model?: string; enabled?: boolean }>
    >,
  ): Promise<DetectedAiProvider | null> {
    const existing = existingProviders[definition.id];

    if (existing?.enabled === false) return null;

    const baseUrl = existing?.base_url?.trim() || definition.defaultBaseUrl;

    try {
      const response = await this.httpClient.request({
        method: "GET",
        url: `${baseUrl}${definition.probeEndpoint}`,
        headers: {},
        timeoutMs: 3000,
      });

      if (response.status !== 200) return null;

      const models = definition.parseModels(response.body);
      if (models.length === 0) return null;

      return {
        id: definition.id,
        displayName: definition.displayName,
        type: definition.type,
        baseUrl,
        models,
      };
    } catch {
      return null;
    }
  }
}
