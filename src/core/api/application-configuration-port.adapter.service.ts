import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import {
  ApplicationConfigurationContract,
  ApplicationConfigurationPort,
} from "@cogno/shared/ports";
import { Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class ApplicationConfigurationPortAdapterService extends ApplicationConfigurationPort {
  readonly configuration$: Observable<ApplicationConfigurationContract>;

  constructor(private readonly configService: ConfigService) {
    super();
    this.configuration$ = configService.config$;
  }

  /** `undefined` until the config has been loaded. */
  getConfiguration(): ApplicationConfigurationContract | undefined {
    try {
      return this.configService.config;
    } catch {
      return undefined;
    }
  }
}
