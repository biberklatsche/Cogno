import { Injectable } from "@angular/core";

/**
 * Whether git itself was usable at the last look. Once it was not, the
 * automatic triggers (focus, cwd, a finished command) run git no more: on
 * macOS without the command line tools every attempt pops Apple's install
 * dialog. Opening the panel or an explicit refresh asks again. One latch
 * for the bound repository and the repositories overview, so both stop and
 * resume together.
 */
@Injectable({ providedIn: "root" })
export class GitAvailability {
  private missingFlag = false;

  get missing(): boolean {
    return this.missingFlag;
  }

  markMissing(): void {
    this.missingFlag = true;
  }

  reset(): void {
    this.missingFlag = false;
  }
}
