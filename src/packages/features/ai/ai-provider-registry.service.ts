import { Injectable } from "@angular/core";
import { ApplicationConfigurationPort } from "@cogno/core-api";
import { AiProviderAdapter, AiProviderConfig, AiProviderStatus } from "./ai.models";
import {
  getAiFeatureConfig,
  isUsableProviderConfig,
  resolveActiveProvider,
} from "./ai-config.utils";
import { OllamaNativeProviderAdapter } from "./providers/ollama-native.provider-adapter";
import { OpenAiCompatibleProviderAdapter } from "./providers/openai-compatible.provider-adapter";

export type ResolvedAiProvider = {
  readonly providerId: string;
  readonly config: AiProviderConfig;
  readonly adapter: AiProviderAdapter;
};

@Injectable({ providedIn: "root" })
export class AiProviderRegistryService {
  private readonly adapterByType = new Map<string, AiProviderAdapter>();
  private selectedProviderId?: string;

  constructor(
    private readonly applicationConfigurationPort: ApplicationConfigurationPort,
    openAiCompatibleProviderAdapter: OpenAiCompatibleProviderAdapter,
    ollamaNativeProviderAdapter: OllamaNativeProviderAdapter,
  ) {
    this.registerAdapter(openAiCompatibleProviderAdapter);
    this.registerAdapter(ollamaNativeProviderAdapter);
  }

  resolveActiveProvider(): ResolvedAiProvider | undefined {
    const configuration = this.applicationConfigurationPort.getConfiguration();
    if (!configuration) {
      return undefined;
    }

    const activeProvider =
      this.resolveSelectedProvider(configuration) ?? resolveActiveProvider(configuration);
    if (!activeProvider) {
      return undefined;
    }

    const adapter = this.adapterByType.get(activeProvider.providerConfig.type);
    if (!adapter) {
      return undefined;
    }

    return {
      providerId: activeProvider.providerId,
      config: activeProvider.providerConfig,
      adapter,
    };
  }

  validateActiveProvider(): ReadonlyArray<string> {
    const configuration = this.applicationConfigurationPort.getConfiguration();
    if (!configuration) {
      return ["Config is not loaded yet."];
    }

    const activeProvider =
      this.resolveSelectedProvider(configuration) ?? resolveActiveProvider(configuration);
    if (!activeProvider) {
      return ["No usable AI provider is configured."];
    }

    const adapter = this.adapterByType.get(activeProvider.providerConfig.type);
    if (!adapter) {
      return [`Unsupported provider type: ${activeProvider.providerConfig.type}`];
    }

    return adapter.validateConfiguration(activeProvider.providerId, activeProvider.providerConfig);
  }

  listEnabledProviderStatuses(): ReadonlyArray<AiProviderStatus> {
    const configuration = this.applicationConfigurationPort.getConfiguration();
    if (!configuration) {
      return [];
    }

    const aiConfig = getAiFeatureConfig(configuration);
    if (!aiConfig || aiConfig.mode === "off") {
      return [];
    }

    return Object.entries(aiConfig.providers ?? {})
      .filter(([, providerConfig]) => isUsableProviderConfig(providerConfig))
      .map(([providerId, providerConfig]) => ({
        providerId,
        providerType: providerConfig.type,
        providerModel: providerConfig.model ?? "",
      }));
  }

  async selectActiveProvider(providerId: string): Promise<void> {
    const configuration = this.applicationConfigurationPort.getConfiguration();
    if (!configuration) {
      return;
    }

    const aiConfig = getAiFeatureConfig(configuration);
    const providerConfig = aiConfig?.providers?.[providerId];
    if (!providerConfig || !isUsableProviderConfig(providerConfig)) {
      return;
    }

    this.selectedProviderId = providerId;
  }

  private registerAdapter(adapter: AiProviderAdapter): void {
    this.adapterByType.set(adapter.type, adapter);
  }

  private resolveSelectedProvider(
    configuration: Readonly<Record<string, unknown>>,
  ): { providerId: string; providerConfig: AiProviderConfig } | undefined {
    if (!this.selectedProviderId) {
      return undefined;
    }

    const aiConfig = getAiFeatureConfig(configuration);
    const providerConfig = aiConfig?.providers?.[this.selectedProviderId];
    if (!providerConfig || !isUsableProviderConfig(providerConfig)) {
      return undefined;
    }

    return {
      providerId: this.selectedProviderId,
      providerConfig,
    };
  }
}
