import { Injectable, isDevMode } from "@angular/core";
import { Paths } from "@cogno/platform";
import { HookScriptPaths } from "./hook-command";

/** Where this Cogno keeps its hook scripts; asked once, the answer never changes. */
@Injectable({ providedIn: "root" })
export class HookScriptPathsService {
  private paths?: Promise<HookScriptPaths>;

  constructor(private readonly platformPaths: Paths) {}

  get(): Promise<HookScriptPaths> {
    this.paths ??= this.platformPaths.agentHookScriptPaths(isDevMode());
    return this.paths;
  }
}
