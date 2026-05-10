import { Injectable, signal } from "@angular/core";
import { DetectedAiProvider } from "./ai-detection.models";

@Injectable({ providedIn: "root" })
export class AiDetectionStore {
  readonly detectedProviders = signal<ReadonlyArray<DetectedAiProvider>>([]);

  setDetected(providers: ReadonlyArray<DetectedAiProvider>): void {
    this.detectedProviders.set(providers);
  }
}
