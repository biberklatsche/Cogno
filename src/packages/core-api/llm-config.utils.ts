export type LlmProviderTypeConfigValue = "openai_compatible" | "ollama_native";

export type LlmProviderConfigValue = {
  readonly type: LlmProviderTypeConfigValue;
  readonly base_url?: string;
  readonly model?: string;
  readonly api_key?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly enabled?: boolean;
};

export type LlmFeatureConfigValue = {
  readonly mode?: "off" | "hidden" | "visible";
  readonly active_provider?: string;
  readonly providers?: Readonly<Record<string, LlmProviderConfigValue>>;
  readonly request?: {
    readonly include_process_tree?: boolean;
    readonly max_commands?: number;
    readonly max_output_chars?: number;
  };
};

type ConfigLike = Record<string, unknown>;

export function getLlmFeatureConfig(configuration: ConfigLike): LlmFeatureConfigValue | undefined {
  const llmConfig = configuration["llm"];
  if (!isPlainObject(llmConfig)) {
    return undefined;
  }

  const providers = isPlainObject(llmConfig["providers"])
    ? normalizeProviders(llmConfig["providers"])
    : undefined;

  return {
    mode: normalizeMode(llmConfig["mode"]),
    active_provider: asNonEmptyString(llmConfig["active_provider"]),
    providers,
    request: isPlainObject(llmConfig["request"])
      ? {
          include_process_tree: asBoolean(llmConfig["request"]["include_process_tree"]),
          max_commands: asNumber(llmConfig["request"]["max_commands"]),
          max_output_chars: asNumber(llmConfig["request"]["max_output_chars"]),
        }
      : undefined,
  };
}

export function hasUsableLlmProvider(configuration: ConfigLike): boolean {
  const llmConfig = getLlmFeatureConfig(configuration);
  if (!llmConfig || llmConfig.mode === "off") {
    return false;
  }

  return Object.entries(llmConfig.providers ?? {}).some(([, providerConfig]) =>
    isUsableProviderConfig(providerConfig),
  );
}

export function resolveActiveProvider(
  configuration: ConfigLike,
): { providerId: string; providerConfig: LlmProviderConfigValue } | undefined {
  const llmConfig = getLlmFeatureConfig(configuration);
  if (!llmConfig || llmConfig.mode === "off") {
    return undefined;
  }

  const providers = llmConfig.providers ?? {};

  const activeProviderId = llmConfig.active_provider;
  if (activeProviderId) {
    const activeProvider = providers[activeProviderId];
    if (activeProvider && isUsableProviderConfig(activeProvider)) {
      return {
        providerId: activeProviderId,
        providerConfig: activeProvider,
      };
    }
  }

  for (const [providerId, providerConfig] of Object.entries(providers)) {
    if (isUsableProviderConfig(providerConfig)) {
      return { providerId, providerConfig };
    }
  }

  return undefined;
}

export function isUsableProviderConfig(
  providerConfig: LlmProviderConfigValue | undefined,
): boolean {
  return Boolean(
    providerConfig &&
      providerConfig.enabled !== false &&
      providerConfig.type &&
      providerConfig.base_url &&
      providerConfig.model,
  );
}

function normalizeProviders(
  value: Record<string, unknown>,
): Readonly<Record<string, LlmProviderConfigValue>> {
  const providers: Record<string, LlmProviderConfigValue> = {};

  for (const [providerId, providerValue] of Object.entries(value)) {
    if (!isPlainObject(providerValue)) {
      continue;
    }

    const headers = isPlainObject(providerValue["headers"])
      ? Object.fromEntries(
          Object.entries(providerValue["headers"])
            .map(([headerName, headerValue]) => [headerName, asNonEmptyString(headerValue)])
            .filter((headerEntry): headerEntry is [string, string] => Boolean(headerEntry[1])),
        )
      : undefined;

    const providerType = normalizeProviderType(providerValue["type"]);
    if (!providerType) {
      continue;
    }

    providers[providerId] = {
      type: providerType,
      base_url: asNonEmptyString(providerValue["base_url"]),
      model: asNonEmptyString(providerValue["model"]),
      api_key: asNonEmptyString(providerValue["api_key"]),
      headers,
      enabled: asBoolean(providerValue["enabled"]),
    };
  }

  return providers;
}

function normalizeProviderType(value: unknown): LlmProviderTypeConfigValue | undefined {
  return value === "openai_compatible" || value === "ollama_native" ? value : undefined;
}

function normalizeMode(value: unknown): LlmFeatureConfigValue["mode"] | undefined {
  return value === "off" || value === "hidden" || value === "visible" ? value : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
