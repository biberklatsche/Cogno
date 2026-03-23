import {Component, computed} from '@angular/core';
import {TerminalStateManager} from '../+state/state';
import {toSignal} from "@angular/core/rxjs-interop";
import {map} from "rxjs";
import { IconComponent } from "@cogno/core-ui";
import {TerminalSession} from "../+state/terminal.session";
import {ContextMenuOverlayService} from "../../menu/context-menu-overlay/context-menu-overlay.service";
import {ContextMenuItem} from "../../menu/context-menu-overlay/context-menu-overlay.types";
import {TooltipDirective} from "../../common/tooltip/tooltip.directive";
import {ConfigService} from "../../config/+state/config.service";
import { timespan } from "../../common/timespan/timespan";

type HeaderCommandViewModel = {
  command?: string;
  duration?: number;
  returnCode?: number;
};

@Component({
  selector: 'app-terminal-header',
  standalone: true,
  imports: [
    IconComponent,
    TooltipDirective
  ],
  template: `
    <div class="terminal-header">
      @if (visibleProgress(); as currentProgress) {
        <span class="progress-track" [class.is-indeterminate]="currentProgress.state === 'indeterminate'">
          <span
            class="progress-bar"
            [style.width.%]="currentProgress.value"
          ></span>
        </span>
      }
      <span class="command-row">
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
      <span class="header-actions">
        @if (isNotificationBadgeVisible()) {
          <span class="notification-indicator" appTooltip="New terminal notification">
            <app-icon name="mdiBell"></app-icon>
          </span>
        }
        <button
          class="button icon-button terminal-menu-button"
          type="button"
          (click)="openMenu($event)">
            <app-icon name="mdiDotsVertical"></app-icon>
        </button>
      </span>
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
      position: relative;
      overflow: hidden;
    }

    .progress-track {
      position: absolute;
      inset: 0 0 auto 0;
      height: 2px;
      background: color-mix(in srgb, var(--highlight-color) 18%, transparent);
      pointer-events: none;
    }

    .progress-bar {
      display: block;
      height: 100%;
      background: var(--highlight-color);
      transition: width 120ms ease-out;
    }

    .progress-track.is-indeterminate .progress-bar {
      width: 35% !important;
      animation: terminal-header-progress-indeterminate 1s linear infinite;
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

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
    }

    .terminal-menu-button {
      flex: 0 0 auto;
    }

    .notification-indicator {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--color-yellow);
      width: 15px;
      height: 15px;
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

    @keyframes terminal-header-progress-indeterminate {
      from {
        transform: translateX(-120%);
      }
      to {
        transform: translateX(320%);
      }
    }
  `
})
export class TerminalHeaderComponent {

  constructor(
    private stateManager: TerminalStateManager,
    private terminalSession: TerminalSession,
    private menu: ContextMenuOverlayService,
    private configService: ConfigService,
  ) {
  }

  commandOutOfView = toSignal(
      this.stateManager.commands$.pipe(
          map((commands): HeaderCommandViewModel | undefined => {
              const commandOutOfView = commands.find((command) => command.isFirstCommandOutOfViewport);
              if (!commandOutOfView) {
                  return undefined;
              }

              return {
                  command: commandOutOfView.command,
                  duration: commandOutOfView.duration,
                  returnCode: commandOutOfView.returnCode,
              };
          }),
      ),
      { initialValue: undefined },
  );

  cwd = toSignal(this.stateManager.state$.pipe(
      map(state => state.cwd)
  ));

  isNotificationBadgeVisible = toSignal(this.stateManager.hasUnreadNotification$, { initialValue: false });
  progress = toSignal(this.stateManager.state$.pipe(
      map(state => state.progress)
  ), {
      initialValue: this.stateManager.state.progress
  });

  isOsc9ProgressBarEnabled = toSignal(this.configService.config$.pipe(
      map(config => config.terminal?.progress_bar?.enabled ?? true)
  ), {
      initialValue: this.getInitialOsc9ProgressBarEnabled()
  });

  visibleProgress = computed(() => {
      const progress = this.progress();
      return this.isOsc9ProgressBarEnabled() && progress?.state !== 'hidden'
          ? progress
          : undefined;
  });

  formatDuration(ms: number): string {
    return timespan(ms);
  }

  openMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.terminalSession.focus();
    const items: ContextMenuItem[] = this.terminalSession.buildHeaderMenu();
    this.menu.openContextForElement(
      event.currentTarget as HTMLElement,
      {items},
      {horizontalAlign: 'right'}
    );
  }

  private getInitialOsc9ProgressBarEnabled(): boolean {
      try {
          return this.configService.config.terminal?.progress_bar?.enabled ?? true;
      } catch {
          return true;
      }
  }
}
