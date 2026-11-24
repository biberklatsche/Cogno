import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActionNameRegistry } from "@cogno/core/workbench/actions/action-name-registry";
import { coreActionNames } from "@cogno/core/workbench/actions/catalog";
import { FeatureHost } from "@cogno/core/workbench/feature-host/feature-host";
import { RunnableActions } from "@cogno/platform/runnable-actions";

/**
 * Keeps the backend's runnable-action classification in sync with the
 * live feature state, so `cogno action run` in a terminal is answered
 * unknown/inactive/dispatched at once. Core actions always dispatch; a feature action
 * dispatches only while its feature is active, else it is inactive. Re-pushed
 * after every feature reconciliation.
 */
@Injectable({ providedIn: "root" })
export class RunnableActionsPublisher {
  constructor(
    private readonly runnableActions: RunnableActions,
    private readonly actionNameRegistry: ActionNameRegistry,
    private readonly featureHost: FeatureHost,
    destroyRef: DestroyRef,
  ) {
    featureHost.reconciled$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.publish());
  }

  private publish(): void {
    const dispatched = new Set<string>(coreActionNames);
    const inactive: string[] = [];
    for (const actionName of this.actionNameRegistry.getActionNames()) {
      if (this.featureHost.isActionActive(actionName)) {
        dispatched.add(actionName);
      } else {
        inactive.push(actionName);
      }
    }
    void this.runnableActions.set([...dispatched], inactive).catch(() => {
      // The backend command is unavailable in some contexts (e.g. tests); ignore.
    });
  }
}
