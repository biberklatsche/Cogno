import { Inject, Injectable } from "@angular/core";
import {
  ApplicationConfigurationContract,
  ApplicationConfigurationPort,
  ConfigurationTransformer,
} from "@cogno/core-api";
import { combineLatest, map, merge, Observable, of, startWith } from "rxjs";
import { ConfigService } from "../config/+state/config.service";

@Injectable({ providedIn: "root" })
export class ApplicationConfigurationPortAdapterService extends ApplicationConfigurationPort {
  readonly configuration$: Observable<ApplicationConfigurationContract>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(ConfigurationTransformer)
    private readonly transformers: readonly ConfigurationTransformer[],
  ) {
    super();
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
