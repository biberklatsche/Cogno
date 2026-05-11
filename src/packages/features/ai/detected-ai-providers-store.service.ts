import { Injectable, signal } from "@angular/core";
import { DetectedAiProvider } from "./ai-detection.models";

@Injectable({ providedIn: "root" })
export class DetectedAiProvidersStore {
  readonly detectedProviders = signal<ReadonlyArray<DetectedAiProvider>>([]);

  setDetected(providers: ReadonlyArray<DetectedAiProvider>): void {
    this.detectedProviders.set(providers);
  }
}
