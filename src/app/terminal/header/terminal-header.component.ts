import {Component} from '@angular/core';
import {TerminalStateManager} from '../+state/state';
import {toSignal} from "@angular/core/rxjs-interop";
import {map, Observable} from "rxjs";

@Component({
  selector: 'app-terminal-header',
  standalone: true,
  template: `
    <div class="terminal-header">
      <span class="cwd">{{cwd()}}</span>
      @if (commandOutOfView(); as command) {
        <span class="command">{{command.command}}</span>
      } @else {
        <span class="command">&nbsp;</span>
      }
    </div>
  `,
  styles: `
    .terminal-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 8px 2px 8px;
      background: #00000000;
      font-family: var(--font-family);
    }
    
    .cwd {
      font-size: .8rem;
      color: var(--foreground-color);
      opacity: 0.8;
    }
    
    .command {
      align-self: flex-start;
      color: var(--foreground-color);
      font-size: 1rem;
      font-weight: bold;
    }
  `
})
export class TerminalHeaderComponent {

  constructor(private stateManager: TerminalStateManager) {
  }

  commandOutOfView = toSignal(this.stateManager.commands$.pipe(
      map(commands => commands.find(s => s.isFirstCommandOutOfViewport))
  ));

  cwd = toSignal(this.stateManager.state$.pipe(
      map(state => state.cwd)
  ));
}
