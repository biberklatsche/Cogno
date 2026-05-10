import { Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { ApplicationConfigurationContract, ApplicationConfigurationPort } from "@cogno/core-api";
import { mergeDetectedProviders } from "@cogno/features/ai/ai-config.utils";
import { AiDetectionStore } from "@cogno/features/ai/ai-detection-store.service";
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
