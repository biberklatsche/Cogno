import { Injectable } from "@angular/core";
import { ConfigService } from "../config/+state/config.service";
import { LlmProviderAdapter, LlmProviderConfig, LlmProviderType } from "./llm-host.models";
import { resolveActiveProvider } from "./llm-provider-config";
import { OllamaNativeProviderAdapter } from "./providers/ollama-native.provider-adapter";
import { OpenAiCompatibleProviderAdapter } from "./providers/openai-compatible.provider-adapter";

export type ResolvedLlmProvider = {
  readonly providerId: string;
  readonly config: LlmProviderConfig;
  readonly adapter: LlmProviderAdapter;
};

@Injectable({ providedIn: "root" })
export class LlmProviderRegistryService {
  private readonly adapterByType = new Map<LlmProviderType, LlmProviderAdapter>();

  constructor(
    private readonly configService: ConfigService,
    openAiCompatibleProviderAdapter: OpenAiCompatibleProviderAdapter,
    ollamaNativeProviderAdapter: OllamaNativeProviderAdapter,
  ) {
    this.registerAdapter(openAiCompatibleProviderAdapter);
    this.registerAdapter(ollamaNativeProviderAdapter);
  }

  resolveActiveProvider(): ResolvedLlmProvider | undefined {
    const config = this.getCurrentConfig();
    if (!config) {
      return undefined;
    }

    const activeProvider = resolveActiveProvider(config);
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

    const activeProvider = resolveActiveProvider(config);
    if (!activeProvider) {
      return ["No usable LLM provider is configured."];
    }

    const adapter = this.adapterByType.get(activeProvider.providerConfig.type);
    if (!adapter) {
      return [`Unsupported provider type: ${activeProvider.providerConfig.type}`];
    }

    return adapter.validateConfiguration(activeProvider.providerId, activeProvider.providerConfig);
  }

  private registerAdapter(adapter: LlmProviderAdapter): void {
    this.adapterByType.set(adapter.type, adapter);
  }

  private getCurrentConfig() {
    try {
      return this.configService.config;
    } catch {
      return undefined;
    }
  }
}
