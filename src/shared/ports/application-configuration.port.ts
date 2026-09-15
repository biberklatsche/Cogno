// Stays in shared/: dual-consumed by core/workbench (feature-host, registrars)
// and features (coding-agent). A port both layers need cannot move to core/api
// (step 24f).
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
