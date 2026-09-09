import { Injectable } from "@angular/core";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { SuggestorRegistry } from "@cogno/core/session/autocomplete/suggestor-registry";
import { TerminalAutocompleteService } from "@cogno/core/session/autocomplete/terminal-autocomplete.service";
import { TerminalHistoryService } from "@cogno/core/session/history/terminal-history.service";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { SessionFact } from "@cogno/core/session/session-facts";
import { ActionFired, ActionFiredEvent } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalId } from "@cogno/shared/domain";
import { Subscription } from "rxjs";

/**
 * The session's answer to keybinding actions: the trigger actions that need
 * this session's autocomplete and history, and the shell-integration command
 * history request. The last tie to the old bus; goes away with it.
 */
@Injectable()
export class SessionKeybindings {
  private readonly subscription = new Subscription();
  private disposed = false;

  constructor(
    private readonly bus: AppBus,
    private readonly host: SessionHost,
    private readonly suggestorRegistry: SuggestorRegistry,
    private readonly autocomplete: TerminalAutocompleteService,
    private readonly history: TerminalHistoryService,
  ) {}

  /** Starts listening for `terminalId`; the host must be initialized already. */
  start(_terminalId: TerminalId, shellProfile: ShellProfile): void {
    if (shellProfile.enable_shell_integration) {
      this.suggestorRegistry.preloadForShellIntegration(shellProfile.shell_type);
    }
    this.subscription.add(this.host.facts$.subscribe((fact) => this.onFact(fact)));
    this.subscription.add(
      this.bus.on$(ActionFired.listener()).subscribe(async (event: ActionFiredEvent) => {
        const performed = await this.performAction(event.payload ?? "");
        if (!performed) return;
        event.performed = true;
        event.defaultPrevented = true;
        event.propagationStopped = true;
      }),
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.subscription.unsubscribe();
  }

  private onFact(fact: SessionFact): void {
    if (fact.type === "commandHistoryRequested") {
      void this.history.triggerCommandHistory();
    }
  }

  /** The keybinding actions the session's dropdowns answer to. */
  private performAction(action: string): Promise<boolean> | boolean {
    switch (action) {
      case "trigger_autocomplete":
        return this.autocomplete.triggerAutocomplete();
      case "trigger_command_history":
        return this.history.triggerCommandHistory();
      case "cycle_tab":
        return this.autocomplete.cycleTab() || this.history.cycleTab();
      default:
        return false;
    }
  }
}
