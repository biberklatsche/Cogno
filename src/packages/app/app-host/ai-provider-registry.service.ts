import { Injectable } from "@angular/core";
import { AiProviderStatusContract } from "@cogno/core-api";
import { ConfigService } from "../config/+state/config.service";
import { AiProviderAdapter, AiProviderConfig, AiProviderType } from "./ai-host.models";
import {
  getAiFeatureConfig,
  isUsableProviderConfig,
  resolveActiveProvider,
} from "./ai-provider-config";
import { OllamaNativeProviderAdapter } from "./providers/ollama-native.provider-adapter";
import { OpenAiCompatibleProviderAdapter } from "./providers/openai-compatible.provider-adapter";

export type ResolvedAiProvider = {
  readonly providerId: string;
  readonly config: AiProviderConfig;
  readonly adapter: AiProviderAdapter;
};

@Injectable({ providedIn: "root" })
export class AiProviderRegistryService {
  private readonly adapterByType = new Map<AiProviderType, AiProviderAdapter>();
  private selectedProviderId?: string;

  constructor(
    private readonly configService: ConfigService,
    openAiCompatibleProviderAdapter: OpenAiCompatibleProviderAdapter,
    ollamaNativeProviderAdapter: OllamaNativeProviderAdapter,
  ) {
    this.registerAdapter(openAiCompatibleProviderAdapter);
    this.registerAdapter(ollamaNativeProviderAdapter);
  }

  resolveActiveProvider(): ResolvedAiProvider | undefined {
    const config = this.getCurrentConfig();
    if (!config) {
      return undefined;
    }

    const activeProvider = this.resolveSelectedProvider(config) ?? resolveActiveProvider(config);
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
    const config = this.getCurrentConfig();
    if (!config) {
      return ["Config is not loaded yet."];
    }

    const activeProvider = this.resolveSelectedProvider(config) ?? resolveActiveProvider(config);
    if (!activeProvider) {
      return ["No usable AI provider is configured."];
    }

    const adapter = this.adapterByType.get(activeProvider.providerConfig.type);
    if (!adapter) {
      return [`Unsupported provider type: ${activeProvider.providerConfig.type}`];
    }

    return adapter.validateConfiguration(activeProvider.providerId, activeProvider.providerConfig);
  }

  listEnabledProviderStatuses(): ReadonlyArray<AiProviderStatusContract> {
    const config = this.getCurrentConfig();
    if (!config) {
      return [];
    }

    const aiConfig = getAiFeatureConfig(config);
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
    const config = this.getCurrentConfig();
    if (!config) {
      return;
    }

    const aiConfig = getAiFeatureConfig(config);
    const providerConfig = aiConfig?.providers?.[providerId];
    if (!providerConfig || !isUsableProviderConfig(providerConfig)) {
      return;
    }
    this.selectedProviderId = providerId;
  }

  private registerAdapter(adapter: AiProviderAdapter): void {
    this.adapterByType.set(adapter.type, adapter);
  }

  private getCurrentConfig() {
    try {
      return this.configService.config;
    } catch {
      return undefined;
    }
  }

  private resolveSelectedProvider(
    config: ReturnType<AiProviderRegistryService["getCurrentConfig"]>,
  ): { providerId: string; providerConfig: AiProviderConfig } | undefined {
    if (!config || !this.selectedProviderId) {
      return undefined;
    }

    const aiConfig = getAiFeatureConfig(config);
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
