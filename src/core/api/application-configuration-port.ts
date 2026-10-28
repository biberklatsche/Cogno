import { Observable } from "rxjs";

export type ApplicationConfigurationContract = Readonly<Record<string, unknown>>;

export abstract class ApplicationConfigurationPort {
  abstract readonly configuration$: Observable<ApplicationConfigurationContract>;
  abstract getConfiguration(): ApplicationConfigurationContract | undefined;
  /**
   * Writes entries into the user's config file, keyed by dotted path
   * (`notification.channel.os.enabled`), and reloads. The schema is the only
   * gate: an unknown key or a value of the wrong type rejects the whole call
   * and nothing is written. A feature writes its own keys, as it reads them.
   */
  abstract update(entries: Readonly<Record<string, unknown>>): Promise<void>;
}
