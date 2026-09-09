import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { ActionContextContract } from "@cogno/shared/domain";
import { CoreActionName } from "./catalog";

/**
 * One core action's handler. Returning `false` means it did not perform (e.g.
 * `copy` with nothing selected), so a `performable` keybinding falls through to
 * the terminal; any other return keeps the existing "consumed" behaviour.
 */
export type ActionHandler = (context: ActionContextContract) => boolean | void;

/**
 * The one place core actions are handled (ARCHITECTURE.md 5). Services register
 * `handle("new_tab", …)` instead of switching on the fired action name; a single
 * subscription routes each `ActionFired` to its handler and applies the same
 * performed/consumed semantics the old `onAction$` did. Exactly one handler per
 * action - a second registration is a programming error.
 */
@Injectable({ providedIn: "root" })
export class ActionHandlers {
  private readonly handlers = new Map<CoreActionName, ActionHandler>();

  constructor(appBus: AppBus, destroyRef: DestroyRef) {
    appBus
      .on$(ActionFired.listener())
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const handler = this.handlers.get(event.payload as CoreActionName);
        if (!handler) {
          return;
        }
        const performed = handler({
          args: event.args ? [...event.args] : undefined,
          terminalId: event.terminalId,
        });
        event.performed = performed === false ? false : !event.trigger?.broadcast;
        if (event.performed) {
          event.defaultPrevented = true;
        }
      });
  }

  /** Register the one handler for a core action. */
  handle(actionName: CoreActionName, handler: ActionHandler): void {
    if (this.handlers.has(actionName)) {
      throw new Error(`Action already has a handler: ${actionName}`);
    }
    this.handlers.set(actionName, handler);
  }

  /** True when a handler is registered for the action. */
  hasHandler(actionName: CoreActionName): boolean {
    return this.handlers.has(actionName);
  }

  /** The core actions that currently have a handler. */
  handledActions(): ReadonlySet<CoreActionName> {
    return new Set(this.handlers.keys());
  }
}
