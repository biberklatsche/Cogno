import { Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { ApplicationConfigurationContract, ApplicationConfigurationPort } from "@cogno/core-api";
import { AiDetectionStore } from "@cogno/features/ai/ai-detection-store.service";
import { DetectedAiProvider } from "@cogno/features/ai/ai-detection.models";
import { combineLatest, map, Observable } from "rxjs";
import { Config } from "../config/+models/config";
import { ConfigService } from "../config/+state/config.service";

@Injectable({ providedIn: "root" })
export class ApplicationConfigurationPortAdapterService extends ApplicationConfigurationPort {
  readonly configuration$: Observable<ApplicationConfigurationContract>;

  constructor(
    private readonly configService: ConfigService,
    private readonly detectionStore: AiDetectionStore,
  ) {
    super();
    this.configuration$ = combineLatest([
      configService.config$,
      toObservable(detectionStore.detectedProviders),
    ]).pipe(map(([config, detected]) => mergeDetectedProviders(config, detected)));
  }

  getConfiguration(): ApplicationConfigurationContract | undefined {
    try {
      return mergeDetectedProviders(
        this.configService.config,
        this.detectionStore.detectedProviders(),
      );
    } catch {
      return undefined;
    }
  }
}

function mergeDetectedProviders(
  config: Config,
  detected: ReadonlyArray<DetectedAiProvider>,
): ApplicationConfigurationContract {
  if (detected.length === 0) return config;

  const ai = config["ai"];
  if (typeof ai !== "object" || ai === null) return config;

  const existingProviders = (ai as Record<string, unknown>)["providers"];
  const providers: Record<string, unknown> =
    typeof existingProviders === "object" && existingProviders !== null
      ? { ...(existingProviders as Record<string, unknown>) }
      : {};

  for (const provider of detected) {
    if (!providers[provider.id]) {
      providers[provider.id] = {
        type: provider.type,
        base_url: provider.baseUrl,
        model: provider.models[0],
        enabled: true,
        auto_detected: true,
      };
    }
  }

  return {
    ...config,
    ai: { ...(ai as Record<string, unknown>), providers },
  };
}
