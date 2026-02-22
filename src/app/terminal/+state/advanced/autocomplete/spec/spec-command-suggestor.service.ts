import { Injectable } from "@angular/core";
import { ShellType } from "../../../../../config/+models/shell-config";
import { Logger } from "../../../../../_tauri/logger";

import { SpecCommandSuggestor } from "../suggestors/spec-command.suggestor";
import { AssetCommandSpecRegistry } from "./asset-command-spec.registry";
import { NpmScriptsSpecProvider } from "./providers/npm-scripts.spec-provider";

@Injectable({ providedIn: "root" })
export class SpecCommandSuggestorService {
    private readonly sharedSuggestor = new SpecCommandSuggestor(
        new AssetCommandSpecRegistry(),
        [new NpmScriptsSpecProvider()],
    );
    private readonly warmUpByShellType = new Map<ShellType, Promise<void>>();

    getSharedSuggestor(): SpecCommandSuggestor {
        return this.sharedSuggestor;
    }

    preloadForShellIntegration(shellType: ShellType): void {
        const cachedWarmUp = this.warmUpByShellType.get(shellType);
        if (cachedWarmUp) return;

        const warmUpTask = this.sharedSuggestor
            .warmUpCommandDefinitionsForShell(shellType)
            .catch(error => {
                Logger.error(`[SpecCommandSuggestorService] warm-up failed for shell '${shellType}': ${String(error)}`);
            })
            .then(() => undefined);
        this.warmUpByShellType.set(shellType, warmUpTask);
    }
}
