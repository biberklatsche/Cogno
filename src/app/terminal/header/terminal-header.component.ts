import {Component} from '@angular/core';
import {TerminalStateManager} from '../+state/state';
import {toSignal} from "@angular/core/rxjs-interop";
import {map, Observable} from "rxjs";

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

  constructor(private stateManager: TerminalStateManager) {
  }

  commandOutOfView = toSignal(this.stateManager.commands$.pipe(
      map(commands => commands.find(s => s.isFirstCommandOutOfViewport))
  ));

  terminalId = toSignal(this.stateManager.state$.pipe(
      map(state => state.terminalId)
  ));

  cwd = toSignal(this.stateManager.state$.pipe(
      map(state => state.cwd)
  ));
}
