import {Component} from '@angular/core';
import {TerminalStateManager} from '../+state/state';
import {toSignal} from "@angular/core/rxjs-interop";
import {map} from "rxjs";
import {IconComponent} from "../../icons/icon/icon.component";
import {TerminalSession} from "../+state/terminal.session";
import {ContextMenuOverlayService} from "../../menu/context-menu-overlay/context-menu-overlay.service";
import {ContextMenuItem} from "../../menu/context-menu-overlay/context-menu-overlay.types";

@Component({
  selector: 'app-terminal-header',
  standalone: true,
  imports: [
    IconComponent
  ],
  template: `
    <div class="terminal-header">
      <span class="command-row">
        @if (isNotificationBadgeVisible()) {
          <span class="notification-badge" title="Neue Terminal-Benachrichtigung"></span>
        }
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
      </span>
      <button
        class="button icon-button terminal-menu-button"
        type="button"
        title="Terminal menu"
        (click)="openMenu($event)">
        <app-icon name="mdiDotsVertical"></app-icon>
      </button>
    </div>
  `,
  styles: `
    .terminal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 8px 2px 8px;
      background: #00000000;
      font-family: var(--font-family);
    }

    .command-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 1.2rem;
      min-width: 0;
      flex: 1;
    }
    
    .cwd {
      font-size: .8rem;
      color: var(--foreground-color);
      opacity: 0.8;
    }
    
    .command {
      color: var(--foreground-color);
      font-size: 1rem;
      font-weight: bold;
      min-width: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }

    .terminal-menu-button {
      flex: 0 0 auto;
      margin-left: auto;
    }

    .notification-badge {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--color-yellow);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-yellow) 80%, transparent);
      flex: 0 0 8px;
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

  constructor(
    private stateManager: TerminalStateManager,
    private terminalSession: TerminalSession,
    private menu: ContextMenuOverlayService,
  ) {
  }

  commandOutOfView = toSignal(this.stateManager.commands$.pipe(
      map(commands => commands.find(s => s.isFirstCommandOutOfViewport))
  ));

  cwd = toSignal(this.stateManager.state$.pipe(
      map(state => state.cwd)
  ));

  isNotificationBadgeVisible = toSignal(this.stateManager.hasUnreadNotification$, { initialValue: false });

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  openMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.terminalSession.focus();
    const items: ContextMenuItem[] = this.terminalSession.buildHeaderMenu();
    this.menu.openContextForElement(event.currentTarget as HTMLElement, {items});
  }
}
