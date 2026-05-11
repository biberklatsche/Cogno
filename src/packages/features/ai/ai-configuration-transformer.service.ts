import { Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { map, Observable } from "rxjs";
import { mergeDetectedProviders } from "./ai-config.utils";
import { AiDetectionStore } from "./ai-detection-store.service";

@Injectable({ providedIn: "root" })
export class AiConfigurationTransformerService {
  readonly changes$: Observable<void>;

  constructor(private readonly store: AiDetectionStore) {
    this.changes$ = toObservable(store.detectedProviders).pipe(map(() => undefined));
  }

  transform(config: Record<string, unknown>): Record<string, unknown> {
    return mergeDetectedProviders(config, this.store.detectedProviders());
  }
}
