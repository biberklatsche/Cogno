import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TerminalNavigator } from "@cogno/core-api";
import { IconComponent, TooltipDirective } from "@cogno/core-ui";
import { ActiveAgent, CodingAgentStartupService, CodingAgentStatusService } from "@cogno/features/coding-agent";
import { AgentAnimationComponent } from "./agent-animation.component";

@Component({
  selector: "app-coding-agents-side",
  standalone: true,
  imports: [IconComponent, TooltipDirective, AgentAnimationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="agents-panel">
      <header class="panel-header">
        <span class="panel-title">Installed Agents</span>
        <button
          type="button"
          class="button icon-button"
          appTooltip="Rescan for agents"
          [disabled]="isScanning()"
          (click)="rescan()"
        >
          <app-icon
            name="mdiRefresh"
            [class.spinning]="isScanning()"
          ></app-icon>
        </button>
      </header>

      <div class="installed-list">
        @if (installedProviders().length === 0 && !isScanning()) {
          <span class="installed-empty">No agents found</span>
        }
        @for (entry of installedProviders(); track entry.provider.id) {
          <div class="installed-entry">
            <app-icon class="installed-icon" name="mdiRobot"></app-icon>
            <span class="installed-name">{{ entry.provider.name }}</span>
            <app-icon
              class="hook-icon"
              [class.hook-ok]="entry.hasHook"
              [class.hook-missing]="!entry.hasHook"
              [name]="entry.hasHook ? 'mdiCheck' : 'mdiAlertCircleOutline'"
              [appTooltip]="entry.hasHook ? 'Hook installed' : 'Hook not installed'"
            ></app-icon>
          </div>
        }
      </div>

      <div class="divider"></div>

      <header class="panel-header">
        <span class="panel-title">Active Agents</span>
      </header>

      <div class="active-list">
        @if (activeAgents().length === 0) {
          <div class="empty-state">
            <span>No agents currently active</span>
          </div>
        }
        @for (agent of activeAgents(); track agent.terminalId) {
          <button
            type="button"
            class="agent-card"
            (click)="navigateTo(agent)"
          >
            <div class="agent-animation">
              <app-agent-animation [terminalId]="agent.terminalId"></app-agent-animation>
            </div>
            <div class="agent-info">
              <span class="agent-name">{{ agent.providerName }}</span>
              <span class="agent-status">{{ statusLabel(agent.status) }}</span>
            </div>
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      padding: 0.25rem 0 0;
    }

    .agents-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 0;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.25rem 0.5rem 0.25rem 0;
    }

    .panel-title {
      font-size: 0.7rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.55;
    }

    .installed-list {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding-bottom: 0.5rem;
    }

    .installed-empty {
      font-size: 0.8rem;
      opacity: 0.5;
      padding: 0.25rem 0;
    }

    .installed-entry {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0;
      font-size: 0.85rem;
    }

    .installed-icon {
      width: 0.9rem;
      height: 0.9rem;
      opacity: 0.6;
      flex-shrink: 0;
    }

    .installed-name {
      flex: 1;
    }

    .hook-icon {
      width: 0.85rem;
      height: 0.85rem;
      flex-shrink: 0;
    }

    .hook-ok {
      color: var(--color-success, #4caf50);
    }

    .hook-missing {
      color: var(--color-warning, #ff9800);
      opacity: 0.8;
    }

    .divider {
      height: 1px;
      background: var(--background-color-20l);
      margin: 0.5rem 0;
    }

    .active-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 2rem 1rem;
      font-size: 0.85rem;
      opacity: 0.5;
      text-align: center;
    }

    .agent-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.75rem;
      border: 1px solid var(--background-color-20l);
      border-radius: 8px;
      background: var(--background-color-10l);
      color: inherit;
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: background 0.1s;
    }

    .agent-card:hover {
      background: var(--background-color-20l);
    }

    .agent-animation {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 21px;
      height: 21px;
    }

    .agent-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .agent-name {
      font-size: 0.85rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .agent-status {
      font-size: 0.75rem;
      opacity: 0.65;
    }

    .spinning {
      animation: spin 0.9s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
})
export class CodingAgentsSideComponent {
  readonly installedProviders = this.startupService.installedProviders;
  readonly isScanning = this.startupService.isScanning;
  readonly activeAgents = this.statusService.activeAgents;

  constructor(
    private readonly startupService: CodingAgentStartupService,
    private readonly statusService: CodingAgentStatusService,
    private readonly navigator: TerminalNavigator,
  ) {}

  rescan(): void {
    void this.startupService.rescan();
  }

  navigateTo(agent: ActiveAgent): void {
    this.navigator.navigateToTerminal(agent.terminalId);
  }

  statusLabel(status: ActiveAgent["status"]): string {
    if (status === "working") return "Working";
    if (status === "question") return "Waiting for input";
    return "Error";
  }
}
