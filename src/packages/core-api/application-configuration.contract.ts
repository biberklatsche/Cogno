import { Observable } from "rxjs";

export type ApplicationConfigurationContract = Readonly<Record<string, unknown>>;

export interface ApplicationConfigurationPortContract {
  readonly configuration$: Observable<ApplicationConfigurationContract>;
  getConfiguration(): ApplicationConfigurationContract | undefined;
}

export abstract class ApplicationConfigurationPort implements ApplicationConfigurationPortContract {
  abstract readonly configuration$: Observable<ApplicationConfigurationContract>;
  abstract getConfiguration(): ApplicationConfigurationContract | undefined;
}
