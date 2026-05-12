import { Injectable, signal } from "@angular/core";
import { DetectedAiProvider } from "./ai-detection.models";

@Injectable({ providedIn: "root" })
export class DetectedAiProvidersStore {
  readonly detectedProviders = signal<ReadonlyArray<DetectedAiProvider>>([]);
  readonly isDetecting = signal(false);

  setDetected(providers: ReadonlyArray<DetectedAiProvider>): void {
    this.detectedProviders.set(providers);
  }

  setIsDetecting(isDetecting: boolean): void {
    this.isDetecting.set(isDetecting);
  }
}
