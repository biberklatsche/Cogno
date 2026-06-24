import { NgStyle } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { TooltipDirective } from "@cogno/core-ui";
import { TimeAgoPipe } from "../../../../common/time-ago/time-ago.pipe";
import { ActionKeybindingPipe } from "../../../../keybinding/pipe/keybinding.pipe";
import { StartEllipsisDirective } from "../../../../common/text/start-ellipsis.directive";
import { HistoryScope } from "./recent-history.types";
import { TerminalHistoryService } from "./terminal-history.service";

const INITIAL_VIEW_STATE = {
  visible: false,
  x: 0,
  y: 0,
  width: 280,
  placement: "below" as const,
  selectedIndex: null,
  entries: [],
  scope: "global" as const,
};

@Component({
  selector: "app-terminal-history",
  standalone: true,
  imports: [NgStyle, TooltipDirective, ActionKeybindingPipe, TimeAgoPipe, StartEllipsisDirective],
  template: `
    @if (viewState().visible) {
      <div
        class="history-panel"
        [ngStyle]="{
          left: viewState().x + 'px',
          top: viewState().y + 'px',
          width: viewState().width + 'px',
          transform: viewState().placement === 'above' ? 'translateY(-100%)' : 'none'
        }"
      >
        <div class="history-list">
          @for (entry of viewState().entries; track entry.command + ':' + entry.executedAt; let i = $index) {
            <button
              class="history-item"
              [class.active]="i === viewState().selectedIndex"
              type="button"
              (click)="select(i)"
            >
              <span class="label" appStartEllipsis [appStartEllipsis]="entry.command"></span>
              <span class="meta">{{ entry.executedAt | timeAgo }}</span>
            </button>
          }
        </div>
        <div class="history-description">
          <span class="scope-badge" [appTooltip]="scopeTooltip()">{{ scopeLabel() }}</span>
          <i>{{ "cycle_history_scope" | actionkeybinding }}</i>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .history-panel {
        position: fixed;
        box-sizing: border-box;
        min-width: 0;
        max-width: 920px;
        overflow: hidden;
        background: var(--background-color);
        border: 1px solid var(--background-color-20l);
        border-radius: 8px;
        box-shadow: var(--shadow3);
        z-index: 110;
        padding: 4px;
      }

      .history-list {
        max-height: calc(6 * 25px + 8px);
        overflow-y: auto;
        overflow-x: hidden;
      }

      .history-item {
        display: flex;
        width: 100%;
        box-sizing: border-box;
        background: transparent;
        color: var(--foreground-color);
        border: none;
        border-radius: var(--button-border-radius);
        text-align: left;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        height: 25px;
        min-height: 25px;
        padding: 4px 8px;
        cursor: default;
        font-family: var(--font-family);
        font-size: calc(var(--font-size) - 1px);
      }

      .history-item.active {
        background: var(--highlight-color-ct2);
        color: var(--background-color);
      }

      .history-item .label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: clip;
        text-align: left;
      }

      .history-item .meta {
        opacity: 0.7;
        font-size: 11px;
        white-space: nowrap;
      }

      .history-description {
        margin-top: 4px;
        padding: 6px 8px 4px;
        border-top: 1px solid var(--background-color-20l);
        color: var(--foreground-color);
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .history-description .scope-badge {
        border-radius: 999px;
        padding: 1px 8px;
        font-size: 10px;
        line-height: 1.5;
        background: var(--background-color-20l);
        color: var(--background-color);
      }

      .history-description i {
        opacity: 0.7;
        font-style: normal;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalHistoryComponent {
  protected readonly viewState = toSignal(this.history.viewState$, {
    initialValue: INITIAL_VIEW_STATE,
  });
  protected readonly scopeLabel = computed(() => this.labelForScope(this.viewState().scope));
  protected readonly scopeTooltip = computed(() => this.tooltipForScope(this.viewState().scope));

  constructor(private readonly history: TerminalHistoryService) {}

  protected select(index: number): void {
    this.history.selectEntry(index);
  }

  private labelForScope(scope: HistoryScope): string {
    if (scope === "cwd") return "Directory";
    if (scope === "session") return "This tab";
    return "Global";
  }

  private tooltipForScope(scope: HistoryScope): string {
    if (scope === "cwd") return "Commands run in the current directory";
    if (scope === "session") return "Commands run in this terminal session";
    return "Commands run anywhere";
  }
}
