import {Component, input, computed, Signal} from '@angular/core';
import {Command, TerminalState} from '../+state/state';
import {TerminalId} from "../../grid-list/+model/model";

@Component({
  selector: 'app-terminal-header',
  standalone: true,
  template: `
    <div class="terminal-header">
      {{terminalId()}}
      {{cwd()}}
      @if (commandOutOfView(); as command) {
        <span class="status-running">{{command.command}}</span>
      }
    </div>
  `,
  styles: `
    .terminal-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 8px;
      background: var(--background-color-20d);
      color: var(--foreground-color);
      font-size: 12px;
      height: 24px;
    }
  `
})
export class TerminalHeaderComponent {
  terminalState  = input.required<TerminalState>();
  history  = input.required<Command[]>();

  constructor() {
  }

  commandOutOfView: Signal<Command | undefined> = computed(() => {
    return this.history().find(s => s.isFirstCommandOutOfViewport);
  });

  terminalId: Signal<TerminalId | undefined> = computed(() => {
    return this.terminalState().terminalId;
  });

  cwd: Signal<TerminalId | undefined> = computed(() => {
    return this.terminalState().cwd;
  });
}
