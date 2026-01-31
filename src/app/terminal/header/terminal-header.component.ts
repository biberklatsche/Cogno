import {Component} from '@angular/core';
import {TerminalStateManager} from '../+state/state';
import {toSignal} from "@angular/core/rxjs-interop";
import {map, Observable} from "rxjs";

@Component({
  selector: 'app-terminal-header',
  standalone: true,
  template: `
    <div class="terminal-header">
      @if (commandOutOfView(); as command) {
        <span class="command">
          {{command.command}}
          @if (command.duration !== undefined || command.returnCode !== undefined) {
            <span class="meta">
              @if (command.duration !== undefined) {
                <span>{{formatDuration(command.duration)}}</span>
              }
              @if (command.returnCode !== undefined) {
                <span>exit {{command.returnCode}}</span>
              }
            </span>
          }
        </span>
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

    .meta {
      margin-left: 0.5rem;
      font-weight: normal;
      font-size: 0.9rem;
      opacity: 0.6;

      span:not(:last-child)::after {
        content: " • ";
        margin: 0 0.25rem;
      }
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

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
