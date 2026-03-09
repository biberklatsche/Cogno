import { Inject, Injectable } from "@angular/core";
import {
  filesystemToken,
  FilesystemContract,
  ShellTypeContract,
  TerminalAutocompleteSuggestorContract,
} from "@cogno/core-sdk";
import { CoreHostWiringService } from "./core-host-wiring.service";

@Injectable({ providedIn: "root" })
export class TerminalAutocompleteFeatureSuggestorService {
  private sharedSuggestors?: ReadonlyArray<TerminalAutocompleteSuggestorContract>;

  constructor(
    private readonly coreHostWiringService: CoreHostWiringService,
    @Inject(filesystemToken) private readonly filesystem: FilesystemContract,
  ) {}

  getSharedSuggestors(): ReadonlyArray<TerminalAutocompleteSuggestorContract> {
    if (!this.sharedSuggestors) {
      this.sharedSuggestors = this.coreHostWiringService
        .getTerminalAutocompleteSuggestorDefinitions()
        .map((definition) => definition.createSuggestor({ filesystem: this.filesystem }));
    }

    return this.sharedSuggestors;
  }

  preloadForShellIntegration(shellType: ShellTypeContract): void {
    for (const suggestor of this.getSharedSuggestors()) {
      void suggestor.warmUpForShellIntegration?.(shellType);
    }
  }
}
