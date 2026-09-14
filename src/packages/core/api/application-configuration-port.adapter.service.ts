import { Inject, Injectable, Optional } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ConfigurationTransformer } from "@cogno/shared/contributions";
import {
  ApplicationConfigurationContract,
  ApplicationConfigurationPort,
} from "@cogno/shared/ports";
import { combineLatest, map, merge, Observable, of, startWith } from "rxjs";

@Injectable({ providedIn: "root" })
export class ApplicationConfigurationPortAdapterService extends ApplicationConfigurationPort {
  readonly configuration$: Observable<ApplicationConfigurationContract>;
  private readonly transformers: readonly ConfigurationTransformer[];

  constructor(
    private readonly configService: ConfigService,
    // No configuration transformers are registered today; optional so the empty
    // multi-token does not fail injection.
    @Optional()
    @Inject(ConfigurationTransformer)
    transformers: readonly ConfigurationTransformer[] | null,
  ) {
    super();
    this.transformers = transformers ?? [];
    const transformerChanges$ =
      this.transformers.length > 0
        ? merge(...this.transformers.map((t) => t.changes$)).pipe(startWith(undefined))
        : of(undefined);

    this.configuration$ = combineLatest([configService.config$, transformerChanges$]).pipe(
      map(([config]) => this.applyTransformers(config)),
    );
  }

  getConfiguration(): ApplicationConfigurationContract | undefined {
    try {
      return this.applyTransformers(this.configService.config);
    } catch {
      return undefined;
    }
  }

  private applyTransformers(config: Record<string, unknown>): Record<string, unknown> {
    return this.transformers.reduce((c, t) => t.transform(c), config);
  }
}
