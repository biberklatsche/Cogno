import type { Observable } from "rxjs";

export abstract class ConfigurationTransformer {
  abstract readonly changes$: Observable<void>;
  abstract transform(config: Record<string, unknown>): Record<string, unknown>;
}
