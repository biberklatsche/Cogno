import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { TerminalNavigator } from "@cogno/core-api";
import { IconComponent, TooltipDirective } from "@cogno/core-ui";
import {
  ActiveAgent,
  CodingAgentStartupService,
  CodingAgentStatusService,
} from "@cogno/features/coding-agent";
import { AgentAnimationComponent } from "./agent-animation.component";

@Component({
  selector: "app-coding-agents-side",
  standalone: true,
  imports: [IconComponent, TooltipDirective, AgentAnimationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="agents-panel">
      @if (view() === "active") {
        <header class="panel-header">
          <span class="panel-title">Active Agents</span>
          <button
            type="button"
            class="button icon-button"
            appTooltip="Detected agents"
            (click)="showDetected()"
          >
            <app-icon name="mdiCog"></app-icon>
          </button>
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
              [class]="agent.status"
              (click)="navigateTo(agent)"
            >
              <div class="agent-animation">
                <app-agent-animation [terminalId]="agent.terminalId"></app-agent-animation>
              </div>
              <div class="agent-info">
                <span class="agent-status">{{ statusLabel(agent.status) }}</span>
                @if (agent.cwd) {
                  <span class="agent-cwd" [appTooltip]="agent.cwd">{{ agent.cwd }}</span>
                }
              </div>
              <div class="agent-meta">
                @if (agent.providerName) {
                  <span class="agent-badge">{{ agent.providerName }}</span>
                }
                @if (agent.lastHook) {
                  <span class="agent-id">{{ agent.lastHook }}</span>
                }
              </div>
            </button>
          }
        </div>
      } @else {
        <header class="panel-header">
          <span class="panel-title">Detected Agents</span>
          <button
            type="button"
            class="button icon-button"
            appTooltip="Back to active agents"
            (click)="showActive()"
          >
            <app-icon name="mdiArrowLeft"></app-icon>
          </button>
        </header>

        <div class="detected-list">
          @if (installedProviders().length === 0 && !isScanning()) {
            <span class="detected-empty">No agents found</span>
          }
          @for (entry of installedProviders(); track entry.provider.id) {
            <div class="detected-entry">
              <app-icon class="detected-icon" name="mdiRobot"></app-icon>
              <span class="detected-name">{{ entry.provider.name }}</span>
              <app-icon
                class="hook-icon"
                [class.hook-ok]="entry.hasHook"
                [class.hook-missing]="!entry.hasHook"
                [name]="entry.hasHook ? 'mdiCheck' : 'mdiAlert'"
                [appTooltip]="entry.hasHook ? 'Hook installed' : 'Hook not installed'"
              ></app-icon>
            </div>
          }
        </div>
        <button
            type="button"
            class="button detect-button"
            [disabled]="isScanning()"
            (click)="rescan()"
        >
          <app-icon
              name="mdiRefresh"
              [class.spinning]="isScanning()"
          ></app-icon>
          <span>Detect Agents</span>
        </button>
      }
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
      padding: 0.25rem 0;
    }

    .panel-title {
      font-size: 0.7rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.55;
    }

    .detected-list {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding-bottom: 0.5rem;
    }

    .detected-empty {
      font-size: 0.8rem;
      opacity: 0.5;
      padding: 0.25rem 0;
    }

    .detected-entry {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0;
      font-size: 0.85rem;
    }

    .detected-icon {
      width: 0.9rem;
      height: 0.9rem;
      opacity: 0.6;
      flex-shrink: 0;
    }

    .detected-name {
      flex: 1;
    }

    .hook-icon {
      width: 0.85rem;
      height: 0.85rem;
      flex-shrink: 0;
    }

    .hook-missing {
      color: var(--color-warning, #ff9800);
      opacity: 0.8;
    }

    .detect-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      width: 100%;
      padding: 0.4rem 0.75rem;
      margin: 0.25rem 0 0.5rem;
      font-size: 0.8rem;
    }

    .active-list {
      display: flex;
      flex-flow: row wrap;
      align-content: flex-start;
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
      border-left-width: 3px;
      border-left-color: var(--agent-status-color, var(--background-color-20l));
      border-radius: 8px;
      background: var(--background-color-10l);
      color: inherit;
      cursor: default;
      text-align: left;
      flex: 1 1 190px;
      min-width: 190px;
      transition: background 0.1s;
    }

    .agent-card:hover {
      background: var(--background-color-20l);
    }

    .agent-card.working { --agent-status-color: var(--color-blue); }
    .agent-card.ready { --agent-status-color: var(--color-green); }
    .agent-card.question { --agent-status-color: var(--color-yellow); }
    .agent-card.error { --agent-status-color: var(--color-red); }

    .agent-animation {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 14px;
      height: 14px;
    }

    .agent-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
      flex: 1;
    }

    .agent-status {
      font-size: 0.85rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .agent-cwd {
      font-size: 0.7rem;
      opacity: 0.45;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      direction: rtl;
      text-align: left;
    }

    .agent-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.2rem;
      flex-shrink: 0;
      align-self: flex-start;
    }

    .agent-id {
      font-size: 0.62rem;
      opacity: 0.25;
      white-space: nowrap;
      font-family: monospace;
    }

    .agent-badge {
      font-size: 0.7rem;
      padding: 0 6px;
      line-height: 18px;
      min-width: 18px;
      text-align: center;
      border-radius: 9px;
      background-color: var(--color-black);
      color: var(--color-white);
      white-space: nowrap;
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
  readonly view = signal<"active" | "detected">("active");

  constructor(
    private readonly startupService: CodingAgentStartupService,
    private readonly statusService: CodingAgentStatusService,
    private readonly navigator: TerminalNavigator,
  ) {}

  showDetected(): void {
    this.view.set("detected");
  }

  showActive(): void {
    this.view.set("active");
  }

  rescan(): void {
    void this.startupService.rescan();
  }

  navigateTo(agent: ActiveAgent): void {
    this.navigator.navigateToTerminal(agent.terminalId);
  }

  statusLabel(status: ActiveAgent["status"]): string {
    if (status === "ready") return "Ready";
    if (status === "working") return "Working";
    if (status === "question") return "Waiting for input";
    return "Error";
  }
}
