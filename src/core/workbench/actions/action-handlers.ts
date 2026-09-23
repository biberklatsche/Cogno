import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { ActionContextContract, ActionTriggerContract } from "@cogno/shared/domain";
import { CoreActionName, coreActionCatalog } from "./catalog";

/** What a handler receives: the fired action's args, target terminal and trigger. */
interface ActionHandlerContext extends ActionContextContract {
  readonly trigger?: ActionTriggerContract;
}

/**
 * One core action's handler. Returning `false` means it did not perform (e.g.
 * `copy` with nothing selected, or a `quit` the user cancelled), so a
 * `performable` keybinding falls through to the terminal; any other return keeps
 * the existing "consumed" behaviour. Async handlers settle `performed` once they
 * resolve (after the synchronous publish, exactly as the old handlers did).
 */
export type ActionHandler = (
  context: ActionHandlerContext,
  // biome-ignore lint/suspicious/noConfusingVoidType: Existing handlers can return void or false, including after awaiting.
) => boolean | void | Promise<boolean | void>;

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
      .on$("ActionFired")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const handler = this.handlers.get(event.payload as CoreActionName);
        if (!handler) {
          return;
        }
        const result = handler({
          args: event.args ? [...event.args] : undefined,
          terminalId: event.terminalId,
          trigger: event.trigger,
        });
        if (result instanceof Promise) {
          void result.then((resolved) => this.applyPerformed(event, resolved));
          return;
        }
        this.applyPerformed(event, result);
      });
  }

  private applyPerformed(
    event: { performed?: boolean; defaultPrevented?: boolean; trigger?: { broadcast: boolean } },
    // biome-ignore lint/suspicious/noConfusingVoidType: A handler's void result means the action was performed.
    result: boolean | void,
  ): void {
    event.performed = result === false ? false : !event.trigger?.broadcast;
    if (event.performed) {
      event.defaultPrevented = true;
    }
  }

  /** Register the one handler for a core action. */
  handle(actionName: CoreActionName, handler: ActionHandler): void {
    if (this.handlers.has(actionName)) {
      throw new Error(`Action already has a handler: ${actionName}`);
    }
    this.handlers.set(actionName, handler);
  }

  /**
   * Core actions declared in the catalog but with no registered handler. Run
   * once every handler-owning service is constructed; a non-empty result is a
   * programming error (a catalog action nothing handles). Core actions are not
   * features, so there is nothing to exempt here.
   */
  unhandledCoreActions(): ReadonlyArray<CoreActionName> {
    return coreActionCatalog.map((entry) => entry.name).filter((name) => !this.handlers.has(name));
  }
}
