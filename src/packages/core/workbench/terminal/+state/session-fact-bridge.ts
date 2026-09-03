import { Injectable } from "@angular/core";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { AutocompleteSuggestorSource } from "@cogno/core/session/autocomplete/autocomplete-suggestor.source";
import { TerminalAutocompleteService } from "@cogno/core/session/autocomplete/terminal-autocomplete.service";
import { TerminalComposerService } from "@cogno/core/session/composer/terminal-composer.service";
import { TerminalHistoryService } from "@cogno/core/session/history/terminal-history.service";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { SessionFact } from "@cogno/core/session/session-facts";
import { ActionFired, ActionFiredEvent } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalId } from "@cogno/shared/ports";
import { Subscription } from "rxjs";
import { KeybindExecutor } from "./keybind/keybind.executor";

/**
 * What is left of the session's tie to the old app bus: the keybinding action
 * triggers that need this session's autocomplete and history, and the keybind
 * executor. Goes away with the bus once those move to the session too.
 */
@Injectable()
export class SessionFactBridge {
  private readonly subscription = new Subscription();
  private keybindExecutor?: KeybindExecutor;
  private disposed = false;

  constructor(
    private readonly bus: AppBus,
    private readonly host: SessionHost,
    private readonly featureSuggestorService: AutocompleteSuggestorSource,
    private readonly autocomplete: TerminalAutocompleteService,
    private readonly history: TerminalHistoryService,
    // Listens to the host's facts itself; injected so it exists for the session.
    _composer: TerminalComposerService,
  ) {}

  /** Starts translating for `terminalId`; the host must be initialized already. */
  start(_terminalId: TerminalId, shellProfile: ShellProfile): void {
    if (shellProfile.enable_shell_integration) {
      this.featureSuggestorService.preloadForShellIntegration(shellProfile.shell_type);
    }
    this.subscription.add(this.host.facts$.subscribe((fact) => this.onFact(fact)));
    this.listenToBus();
    this.keybindExecutor = new KeybindExecutor(this.bus, this.host);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keybindExecutor?.dispose();
    this.subscription.unsubscribe();
  }

  private onFact(fact: SessionFact): void {
    if (fact.type === "commandHistoryRequested") {
      void this.history.triggerCommandHistory();
    }
    // Every other fact is handled off the bridge now (registry.facts$
    // consumers, the per-session notifications) or is session-internal.
  }

  private listenToBus(): void {
    // The keybind action triggers need this session's autocomplete/history and
    // depend on focus, so they stay here until the session owns them.
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
