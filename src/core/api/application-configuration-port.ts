import { Observable } from "rxjs";

export type ApplicationConfigurationContract = Readonly<Record<string, unknown>>;

export abstract class ApplicationConfigurationPort {
  abstract readonly configuration$: Observable<ApplicationConfigurationContract>;
  abstract getConfiguration(): ApplicationConfigurationContract | undefined;
}
