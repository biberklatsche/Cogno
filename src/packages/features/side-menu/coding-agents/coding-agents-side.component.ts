import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { TerminalNavigator } from "@cogno/core-api";
import {
  buildNotificationPreferencesMenuItems,
  NotificationPreferencesState,
} from "@cogno/core-domain";
import { ContextMenuOverlayService, IconComponent, TooltipDirective } from "@cogno/core-ui";
import {
  ActiveAgent,
  CodingAgentNotificationPreferencesService,
  CodingAgentStartupService,
  CodingAgentStatusService,
} from "@cogno/features/coding-agent";
import { AgentStatus } from "@cogno/features/coding-agent/coding-agent-status.service";
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
          <div class="header-actions">
            <button
              type="button"
              class="button icon-button"
              appTooltip="Notification settings"
              (click)="openNotificationMenu($event)"
            >
              <app-icon name="mdiBellCog"></app-icon>
            </button>
            <button
              type="button"
              class="button icon-button"
              appTooltip="Detected agents"
              (click)="showDetected()"
            >
              <app-icon name="mdiCog"></app-icon>
            </button>
          </div>
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
                @if (agent.cwd) {
                  <span class="agent-cwd" [appTooltip]="agent.cwd">{{ agent.cwd }}</span>
                }
                <span class="agent-status">{{ statusLabel(agent.status) }}</span>
                @if (agent.activity) {
                  <span class="agent-activity" [appTooltip]="agent.activity">{{ agent.activity }}</span>
                } @else {
                  <span class="agent-activity">_</span>
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

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
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
      border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
      border-left-width: 3px;
      border-left-color: var(--agent-status-color, color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color)));
      border-radius: 8px;
      background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
      color: inherit;
      cursor: default;
      text-align: left;
      flex: 1 1 400px;
      min-width: 265px;
      transition: background 0.1s;
    }

    .agent-card:hover {
      background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
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
      font-size: 0.80rem;
      font-weight: 100;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .agent-cwd {
      font-size: 0.85rem;
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      direction: rtl;
      text-align: left;
    }

    .agent-activity {
      font-size: 0.8rem;
      font-weight: 100;
      opacity: 0.6;
      font-family: monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
      font-size: 0.7rem;
      opacity: 0.25;
      font-weight: 100;
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

  readonly notificationPreferencesState = this.notificationPreferences.state;

  get notificationDefinitions() {
    return this.notificationPreferences.getNotificationDefinitions();
  }

  get channelOptions() {
    return this.notificationPreferences.getChannelOptions();
  }

  constructor(
    private readonly startupService: CodingAgentStartupService,
    private readonly statusService: CodingAgentStatusService,
    private readonly notificationPreferences: CodingAgentNotificationPreferencesService,
    private readonly navigator: TerminalNavigator,
    private readonly contextMenu: ContextMenuOverlayService,
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
    this.navigator.navigateToTerminal(agent.terminalId).catch((error: unknown) => {
      console.error("[coding-agents-side] Failed to navigate to terminal:", error);
    });
  }

  statusLabel(status: AgentStatus): string {
    if (status === "ready") return "Ready";
    if (status === "working") return "Working";
    if (status === "question") return "Waiting for input";
    return "Error";
  }

  openNotificationMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const items = buildNotificationPreferencesMenuItems({
      notificationDefinitions: this.notificationDefinitions,
      channels: this.channelOptions,
      state: this.notificationPreferencesState(),
      onToggleNotification: (id) => this.toggleNotification(id),
      onToggleChannel: (id) => this.toggleChannel(id),
    });
    this.contextMenu.openAtElement(
      event.currentTarget as HTMLElement,
      { items },
      { horizontalAlign: "right" },
    );
  }

  toggleNotification(notificationId: string): NotificationPreferencesState {
    this.notificationPreferences.toggleNotification(notificationId);
    return this.notificationPreferencesState();
  }

  toggleChannel(channelId: string): NotificationPreferencesState {
    this.notificationPreferences.toggleChannel(channelId);
    return this.notificationPreferencesState();
  }
}
