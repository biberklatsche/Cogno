import { ChangeDetectionStrategy, Component, computed, DestroyRef, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { SessionApi } from "@cogno/core/api/session-api";
import { TerminalNavigator } from "@cogno/core/api/terminal-navigator-port";
import {
  buildNotificationPreferencesMenuItems,
  NotificationPreferencesState,
} from "@cogno/shared/domain";
import {
  ContextMenuOverlayService,
  CopyEditDeleteComponent,
  IconComponent,
  StartEllipsisDirective,
  TooltipDirective,
} from "@cogno/shared/ui";
import { interval } from "rxjs";
import { AgentAnimationComponent } from "./agent-animation.component";
import { groupAgentsByWorkspace } from "./agent-groups";
import { CodingAgentNotificationPreferencesService } from "./coding-agent-notification-preferences.service";
import { CodingAgentStartupService } from "./coding-agent-startup.service";
import { ActiveAgent, CodingAgentStatusService } from "./coding-agent-status.service";
import type { ICodingAgentProvider } from "./ports";

/** How often the elapsed time on a working card is refreshed. */
const ELAPSED_TICK_MS = 1000;

/**
 * What a card says about its agent. Splits "ready" into done (a task was worked on)
 * and idle (nothing asked yet), so the summary and the card never disagree.
 */
export type CardState = "working" | "question" | "error" | "done" | "idle";

export function cardState(agent: ActiveAgent): CardState {
  if (agent.status !== "ready") return agent.status;
  return agent.task ? "done" : "idle";
}

const CARD_STATE_LABELS: Record<CardState, string> = {
  working: "Working",
  question: "Needs you",
  error: "Error",
  done: "Done",
  idle: "Idle",
};

/** "1 subagent", "2 subagents". */
export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

@Component({
  selector: "app-coding-agents-side",
  standalone: true,
  imports: [
    IconComponent,
    TooltipDirective,
    StartEllipsisDirective,
    AgentAnimationComponent,
    CopyEditDeleteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="agents-panel">
      @if (view() === "active") {
        <header class="panel-header">
          <div class="summary">
            @if (summary().working > 0) {
              <span class="summary-chip working"><span class="dot"></span>{{ summary().working }} working</span>
            }
            @if (summary().question > 0) {
              <span class="summary-chip question"><span class="dot"></span>{{ countOf(summary().question, "needs you", "need you") }}</span>
            }
            @if (summary().error > 0) {
              <span class="summary-chip error"><span class="dot"></span>{{ countOf(summary().error, "error") }}</span>
            }
            @if (summary().done > 0) {
              <span class="summary-chip done"><span class="dot"></span>{{ summary().done }} done</span>
            }
            @if (summary().idle > 0) {
              <span class="summary-chip idle"><span class="dot"></span>{{ summary().idle }} idle</span>
            }
          </div>
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
          @for (group of groups(); track group.workspaceId) {
            @if (group.workspaceName) {
              <div class="group-header">
                <span
                  class="workspace-dot"
                  [style.background-color]="'var(--color-' + group.workspaceColor + ')'"
                ></span>
                <span class="group-name">{{ group.workspaceName }}</span>
              </div>
            }
            @for (agent of group.agents; track agent.terminalId) {
              <button
                type="button"
                class="agent-card"
                [class]="cardState(agent)"
                [class.focused]="agent.terminalId === focusedTerminalId()"
                (click)="navigateTo(agent)"
              >
                <div class="agent-state">
                  <app-agent-animation [terminalId]="agent.terminalId"></app-agent-animation>
                  <span class="state-label">
                    {{ statusLabel(agent) }}
                    @if (agent.status === "working") {
                      · {{ elapsed(agent) }}
                    }
                  </span>
                  @if (agent.subagentCount > 0) {
                    <span class="subagent-pill">{{ countOf(agent.subagentCount, "subagent") }}</span>
                  }
                  @if (agent.providerName) {
                    <span class="agent-badge">{{ agent.providerName }}</span>
                  }
                </div>
                @if (agent.task) {
                  <span class="agent-task" [appTooltip]="agent.task">{{ agent.task }}</span>
                } @else {
                  <span class="agent-task placeholder">No prompt yet</span>
                }
                <div class="agent-footer">
                  <span class="agent-detail" [appTooltip]="detail(agent) ?? ''">{{ detail(agent) ?? "" }}</span>
                  <span
                    class="agent-tab"
                    [appStartEllipsis]="agent.placement?.tabTitle ?? agent.cwd ?? ''"
                    [appTooltip]="agent.cwd ?? ''"
                  ></span>
                </div>
              </button>
            }
          }
        </div>
      } @else {
        <header class="panel-header">
          <span class="panel-title">Settings</span>
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
              <app-icon
                class="detected-icon"
                [class.hook-missing]="!entry.hasHook"
                [name]="entry.hasHook ? 'mdiRobot' : 'mdiRobotOff'"
                [appTooltip]="entry.hasHook ? 'Hook installed' : 'Hook not installed'"
              ></app-icon>
              <span class="detected-name">{{ entry.provider.name }}</span>
              @if (entry.hasHook) {
                <app-copy-edit-delete
                  class="hook-action"
                  [enableEdit]="false"
                  [enableDelete]="true"
                  (onEvent)="$event === 'delete' && removeHook(entry.provider)"
                ></app-copy-edit-delete>
              } @else {
                <button
                  type="button"
                  class="button icon-button hook-action"
                  [appTooltip]="'Install hook'"
                  (click)="installHook(entry.provider)"
                >
                  <app-icon name="mdiPlus"></app-icon>
                </button>
              }
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
      gap: 0.5rem;
      padding: 0.25rem 0;
    }

    .summary {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.3rem;
      min-width: 0;
    }

    .summary-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
      color: var(--agent-state-color);
      background: color-mix(in srgb, var(--agent-state-color) 14%, transparent);
    }

    .summary-chip .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--agent-state-color);
    }

    .working { --agent-state-color: var(--color-blue); }
    .question { --agent-state-color: var(--color-yellow); }
    .error { --agent-state-color: var(--color-red); }
    .done { --agent-state-color: var(--color-green); }
    .idle { --agent-state-color: color-mix(in srgb, var(--foreground-color) 65%, transparent); }

    .header-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex: 1;
      gap: 0.25rem;
    }

    .detected-list {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.5rem 0;
    }

    .detected-empty {
      font-size: 0.8rem;
      opacity: 0.5;
      padding: 0.25rem 0;
    }

    /* Sized to the 26px icon-button at the end of the row (18px icon inside). */
    .detected-entry {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 26px;
      font-size: 1rem;
    }

    .detected-icon {
      width: 18px;
      height: 18px;
      opacity: 0.6;
      flex-shrink: 0;
    }

    .detected-name {
      flex: 1;
    }

    .hook-missing {
      color: var(--color-warning, #ff9800);
      opacity: 0.8;
    }

    .hook-action {
      flex-shrink: 0;
    }

    button.hook-action {
      color: color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent);

      &:hover {
        color: var(--foreground-color);
      }
    }

    .detect-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      width: 100%;
      padding: 0.4rem 0.75rem;
      margin: 0.25rem 0 0.5rem;
      font-size: 1rem;
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

    .group-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-basis: 100%;
      margin-top: 1rem;
      font-size: 0.8rem;
      opacity: 0.75;
    }

    .group-header:first-child {
      margin-top: 0.5rem;
    }

    .workspace-dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .group-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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

    /* One card = fixed slots: identity, task, state, detail. */
    .agent-card {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      padding: 0.65rem 0.8rem;
      border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
      border-radius: 10px;
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

    .agent-card.focused {
      border-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-4)), var(--background-color));
    }

    /* A card that needs the user is tinted as a whole, not just marked. */
    .agent-card.question,
    .agent-card.error {
      background: color-mix(in srgb, var(--agent-state-color) 9%, var(--background-color));
      border-color: color-mix(in srgb, var(--agent-state-color) 55%, transparent);
    }

    .agent-card.question:hover,
    .agent-card.error:hover {
      background: color-mix(in srgb, var(--agent-state-color) 14%, var(--background-color));
    }

    .agent-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      font-size: 0.75rem;
      line-height: 1.4;
      /* Fixed height: an empty detail line must not shrink the card. */
      height: 1.4em;
    }

    .agent-tab {
      flex-shrink: 0;
      max-width: 45%;
      opacity: 0.55;
      white-space: nowrap;
      overflow: hidden;
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
      flex-shrink: 0;
      margin-left: auto;
    }

    .agent-task {
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.35;
      /* One line, always: cards stay the same height, the tooltip carries the full prompt. */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .agent-task.placeholder {
      font-style: italic;
      font-weight: 400;
      opacity: 0.5;
    }

    .agent-card.done .agent-task {
      opacity: 0.75;
    }

    /* The animation stands free, as it does in the tab header; only the label carries the state colour. */
    .agent-state {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      /* Fixed height: the subagent pill must not push the line below. */
      height: 1.5rem;
      font-size: 0.85rem;
      color: var(--agent-state-color);
    }

    /* Block, not inline-flex: an inline box would sit on the text baseline instead of centring. */
    .agent-state app-agent-animation {
      display: flex;
    }

    /* The ghost's top two rows are near-empty antenna, so its visible body sits below the
       box centre; the text moves down to meet it. */
    .state-label {
      font-weight: 500;
      white-space: nowrap;
      margin-top: 2px;
    }

    .subagent-pill {
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-weight: 500;
      white-space: nowrap;
      color: var(--foreground-color);
      background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
    }

    .agent-detail {
      flex: 1;
      min-width: 0;
      font-family: monospace;
      opacity: 0.65;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .agent-card.question .agent-detail,
    .agent-card.error .agent-detail {
      color: var(--agent-state-color);
      opacity: 0.9;
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
  readonly groups = computed(() => groupAgentsByWorkspace(this.activeAgents()));
  readonly summary = computed(() => {
    const counts: Record<CardState, number> = {
      working: 0,
      question: 0,
      error: 0,
      done: 0,
      idle: 0,
    };
    for (const agent of this.activeAgents()) counts[cardState(agent)] += 1;
    return counts;
  });
  readonly view = signal<"active" | "detected">("active");

  /** Ticks every second while an agent works, so its elapsed time stays current. */
  private readonly now = signal(Date.now());
  private readonly hasWorkingAgent = computed(() =>
    this.activeAgents().some((agent) => agent.status === "working"),
  );

  private readonly focusedTerminalIdSignal = signal<string | undefined>(undefined);
  readonly focusedTerminalId = this.focusedTerminalIdSignal.asReadonly();

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
    sessionApi: SessionApi,
    destroyRef: DestroyRef,
  ) {
    // Highlight the agent whose terminal is the bound (focused) session.
    sessionApi.boundSession$.pipe(takeUntilDestroyed(destroyRef)).subscribe((boundSession) => {
      this.focusedTerminalIdSignal.set(
        boundSession.status === "active" ? boundSession.session.identity.terminalId : undefined,
      );
    });

    interval(ELAPSED_TICK_MS)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        if (this.hasWorkingAgent()) this.now.set(Date.now());
      });
  }

  showDetected(): void {
    this.view.set("detected");
  }

  showActive(): void {
    this.view.set("active");
  }

  installHook(provider: ICodingAgentProvider): void {
    void this.startupService.installHook(provider);
  }

  removeHook(provider: ICodingAgentProvider): void {
    void this.startupService.removeHook(provider);
  }

  rescan(): void {
    void this.startupService.rescan();
  }

  navigateTo(agent: ActiveAgent): void {
    this.navigator.navigateToTerminal(agent.terminalId).catch((error: unknown) => {
      console.error("[coding-agents-side] Failed to navigate to terminal:", error);
    });
  }

  /** Time spent working: "42s", "3m 05s", "1h 12m". */
  elapsed(agent: ActiveAgent): string {
    const seconds = Math.max(0, Math.floor((this.now() - agent.statusSince) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  }

  readonly countOf = countOf;
  readonly cardState = cardState;

  statusLabel(agent: ActiveAgent): string {
    return CARD_STATE_LABELS[cardState(agent)];
  }

  /** The detail line follows the state: the closing message once done, else the last activity. */
  detail(agent: ActiveAgent): string | undefined {
    return agent.status === "ready" ? agent.result : agent.activity;
  }

  openNotificationMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const items = buildNotificationPreferencesMenuItems({
      notificationDefinitions: this.notificationDefinitions,
      notificationsLabel: "Notify me when…",
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
