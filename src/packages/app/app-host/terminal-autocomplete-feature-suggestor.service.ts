import { Inject, Injectable } from "@angular/core";
import { commandRunnerToken, filesystemToken } from "@cogno/app/app-host/app-host.tokens";
import {
  CommandRunnerContract,
  FilesystemContract,
  ShellTypeContract,
  TerminalAutocompleteSuggestorContract,
} from "@cogno/core-api";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";

@Injectable({ providedIn: "root" })
export class TerminalAutocompleteFeatureSuggestorService {
  private sharedSuggestors?: ReadonlyArray<TerminalAutocompleteSuggestorContract>;

  constructor(
    private readonly wiringService: AppWiringService,
    @Inject(filesystemToken) private readonly filesystem: FilesystemContract,
    @Inject(commandRunnerToken) private readonly commandRunner: CommandRunnerContract,
  ) {}

  getSharedSuggestors(): ReadonlyArray<TerminalAutocompleteSuggestorContract> {
    if (!this.sharedSuggestors) {
      this.sharedSuggestors = this.wiringService
        .getTerminalAutocompleteSuggestorDefinitions()
        .map((definition) => definition.createSuggestor({
          filesystem: this.filesystem,
          commandRunner: this.commandRunner,
        }));
    }

    return this.sharedSuggestors;
  }

  preloadForShellIntegration(shellType: ShellTypeContract): void {
    for (const suggestor of this.getSharedSuggestors()) {
      void suggestor.warmUpForShellIntegration?.(shellType);
    }
  }
}

