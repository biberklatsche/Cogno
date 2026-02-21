import { Injectable } from "@angular/core";

import { SpecCommandSuggestor } from "../suggestors/spec-command.suggestor";
import { AssetCommandSpecRegistry } from "./asset-command-spec.registry";
import { NpmScriptsSpecProvider } from "./providers/npm-scripts.spec-provider";

@Injectable({ providedIn: "root" })
export class SpecCommandSuggestorService {
    private readonly sharedSuggestor = new SpecCommandSuggestor(
        new AssetCommandSpecRegistry(),
        [new NpmScriptsSpecProvider()],
    );

    getSharedSuggestor(): SpecCommandSuggestor {
        return this.sharedSuggestor;
    }
}
