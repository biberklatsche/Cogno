import { Injectable } from "@angular/core";
import { ApplicationConfigurationContract, ApplicationConfigurationPort } from "@cogno/core-api";
import { Observable } from "rxjs";
import { ConfigService } from "../config/+state/config.service";

@Injectable({ providedIn: "root" })
export class ApplicationConfigurationPortAdapterService extends ApplicationConfigurationPort {
  readonly configuration$: Observable<ApplicationConfigurationContract>;

  constructor(private readonly configService: ConfigService) {
    super();
    this.configuration$ = this.configService.config$;
  }

  getConfiguration(): ApplicationConfigurationContract | undefined {
    try {
      return this.configService.config;
    } catch {
      return undefined;
    }
  }
}
