import { NgStyle } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  signal,
  ViewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { TooltipDirective } from "@cogno/core-ui";
import { StartEllipsisDirective } from "../../../../common/text/start-ellipsis.directive";
import { ActionKeybindingPipe } from "../../../../keybinding/pipe/keybinding.pipe";
import { AutocompleteSuggestion } from "./autocomplete.types";
import { TerminalAutocompleteService } from "./terminal-autocomplete.service";

const ITEM_HEIGHT_PX = 32;
const MAX_VISIBLE_ITEMS = 5;
const LIST_VERTICAL_PADDING_PX = 4;
const VIRTUAL_BUFFER_ITEMS = 3;

@Component({
  selector: "app-terminal-autocomplete",
  standalone: true,
  imports: [NgStyle, TooltipDirective, ActionKeybindingPipe, StartEllipsisDirective],
  template: `
        @if (viewState().visible) {
            <div
                #panel
                class="autocomplete-panel"
                [ngStyle]="{
                    left: viewState().x + 'px',
                    top: viewState().y + 'px',
                    width: viewState().width + 'px',
                    transform: viewState().placement === 'above' ? 'translateY(-100%)' : 'none'
                }"
            >
                <div class="autocomplete-list" #list (scroll)="onListScroll($event)">
                    <div
                        class="autocomplete-list-viewport"
                        [style.height.px]="totalContentHeight()"
                    >
                    @for (entry of visibleSuggestions(); track entry.item.label + ':' + entry.index) {
                        <button
                            [attr.data-index]="entry.index"
                            class="autocomplete-item"
                            [class.active]="entry.index === viewState().selectedIndex"
                            [style.transform]="'translateY(' + entry.offsetTop + 'px)'"
                            type="button"
                        >
                            <span
                                class="label"
                                appStartEllipsis
                                [appStartEllipsis]="entry.item.label"
                                [appStartEllipsisMatches]="entry.item.matchRanges"
                            ></span>
                            <span class="meta" appTooltip="{{ entry.item.source }} &middot; {{ entry.item.score }}">
                                <span
                                    class="source-dot"
                                    [class.history]="isHistorySuggestion(entry.item)"
                                    [class.context]="!isHistorySuggestion(entry.item)"
                                ></span>
                            </span>
                        </button>
                    }
                    </div>
                </div>
                <div class="autocomplete-description">
                    <span class="description-text" [appTooltip]="selectedDescription()">
                        {{ selectedDescription() || ' ' }}
                    </span>
                        <span class="description-hint">
                        <span class="mode-badge"
                              [appTooltip]="filterModeTooltip()"
                              [class.mode-all]="filterMode() === 'all'"
                              [class.mode-history]="filterMode() === 'history-only'"
                              [class.mode-context]="filterMode() === 'context-only'"
                        >
                            {{ filterModeLabel() }}     
                        </span>
                        <i>
                            {{ 'cycle_completion_mode' | actionkeybinding }}
                        </i>
                    </span>
                </div>
            </div>
        }
    `,
  styles: [
    `
        .autocomplete-panel {
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

        .autocomplete-list {
            max-height: calc(5 * 32px + 8px);
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
        }

        .autocomplete-list-viewport {
            position: relative;
            width: 100%;
        }

        .autocomplete-item {
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
            height: 32px;
            min-height: 32px;
            padding: 4px 8px;
            cursor: default;
            font-family: var(--font-family);
            font-size: calc(var(--font-size) - 1px);
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
        }

        .autocomplete-item.active {
            background: var(--highlight-color-ct2);
            color: var(--background-color);
        }

        .autocomplete-item .label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: clip;
            text-align: left;
        }

        .autocomplete-item .label .match {
            color: var(--highlight-color);
            text-decoration: underline;
            text-underline-offset: 2px;
        }

        .autocomplete-item.active .label .match {
            color: var(--foreground-color);
        }

        .autocomplete-item .meta {
            opacity: 0.7;
            font-size: 11px;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .autocomplete-item .meta .source-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            flex: 0 0 auto;
        }

        .autocomplete-item .meta .source-dot.history {
            background: var(--color-green);
        }

        .autocomplete-item .meta .source-dot.context {
            background: var(--color-blue);
        }

        .autocomplete-description {
            margin-top: 4px;
            padding: 6px 8px 4px;
            border-top: 1px solid var(--background-color-20l);
            color: var(--foreground-color);
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            line-height: 1.35;
        }

        .autocomplete-description .description-text {
            flex: 1 1 auto;
            min-width: 0;
            text-align: left;
            font-style: italic;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .autocomplete-description .description-hint {
            flex: 0 0 auto;
            text-align: right;
            white-space: nowrap;
            opacity: 0.7;
            font-style: normal;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .autocomplete-description .description-hint .mode-badge {
            border-radius: 999px;
            padding: 1px 8px;
            font-size: 10px;
            line-height: 1.5;
            color: var(--background-color);
            opacity: 1;
        }

        .autocomplete-description .description-hint .mode-badge.mode-all {
            background: var(--background-color-20l);
        }

        .autocomplete-description .description-hint .mode-badge.mode-history {
            background: var(--color-green);
        }

        .autocomplete-description .description-hint .mode-badge.mode-context {
            background: var(--color-blue);
        }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalAutocompleteComponent {
  @ViewChild("list") private listRef?: ElementRef<HTMLDivElement>;
  private readonly scrollTop = signal(0);
  private previousSuggestions: AutocompleteSuggestion[] = [];

  protected readonly viewState = toSignal(this.autocomplete.viewState$, {
    initialValue: {
      visible: false,
      x: 0,
      y: 0,
      width: 280,
      placement: "below",
      selectedIndex: null,
      suggestions: [],
    },
  });
  protected readonly filterMode = toSignal(this.autocomplete.filterMode$, { initialValue: "all" });
  protected readonly filterModeLabel = computed(() => {
    const mode = this.filterMode();
    if (mode === "context-only") return "Context";
    if (mode === "history-only") return "History";
    return "All";
  });
  protected readonly filterModeTooltip = computed(() => {
    const mode = this.filterMode();
    if (mode === "context-only") return "Suggestions based on the current context";
    if (mode === "history-only") return "Suggestions from your command history";
    return "Suggestions from history and the current context";
  });
  protected readonly viewportHeight =
    ITEM_HEIGHT_PX * MAX_VISIBLE_ITEMS + LIST_VERTICAL_PADDING_PX * 2;
  protected readonly totalContentHeight = computed(
    () => this.viewState().suggestions.length * ITEM_HEIGHT_PX + LIST_VERTICAL_PADDING_PX * 2,
  );
  protected readonly visibleSuggestions = computed(() => {
    const suggestions = this.viewState().suggestions;
    const maxVisibleItems = Math.min(MAX_VISIBLE_ITEMS, suggestions.length);
    const rawStartIndex = Math.floor(this.scrollTop() / ITEM_HEIGHT_PX) - VIRTUAL_BUFFER_ITEMS;
    const startIndex = Math.max(0, rawStartIndex);
    const endIndex = Math.min(
      suggestions.length,
      startIndex + maxVisibleItems + VIRTUAL_BUFFER_ITEMS * 2,
    );

    return suggestions.slice(startIndex, endIndex).map((item, offset) => {
      const index = startIndex + offset;
      return {
        index,
        item,
        offsetTop: LIST_VERTICAL_PADDING_PX + index * ITEM_HEIGHT_PX,
      };
    });
  });

  constructor(private readonly autocomplete: TerminalAutocompleteService) {
    effect(() => {
      const view = this.viewState();
      if (view.suggestions !== this.previousSuggestions) {
        this.previousSuggestions = view.suggestions;
        this.resetScroll();
      }
      if (!view.visible || view.selectedIndex === null) return;
      const selectedIndex = view.selectedIndex;
      queueMicrotask(() => this.scrollSelectedIntoView(selectedIndex));
    });
  }

  protected selectedDescription(): string {
    const view = this.viewState();
    if (view.suggestions.length === 0) return "";
    if (view.selectedIndex === null) return "";
    const index = view.selectedIndex;
    return view.suggestions[index]?.description ?? "";
  }

  protected isHistorySuggestion(item: AutocompleteSuggestion): boolean {
    const parts = item.source
      .split("+")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    return parts.some((part) => part.includes("history"));
  }

  protected onListScroll(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLDivElement)) return;
    this.scrollTop.set(target.scrollTop);
  }

  private scrollSelectedIntoView(index: number): void {
    const list = this.listRef?.nativeElement;
    if (!list) return;

    const itemTop = index * ITEM_HEIGHT_PX;
    const itemBottom = itemTop + ITEM_HEIGHT_PX;
    const viewportTop = list.scrollTop;
    const viewportBottom = viewportTop + this.viewportHeight;

    if (itemTop < viewportTop) {
      list.scrollTop = itemTop;
      this.scrollTop.set(list.scrollTop);
      return;
    }

    if (itemBottom > viewportBottom) {
      list.scrollTop = itemBottom - this.viewportHeight;
      this.scrollTop.set(list.scrollTop);
    }
  }

  private resetScroll(): void {
    this.scrollTop.set(0);
    const list = this.listRef?.nativeElement;
    if (list) {
      list.scrollTop = 0;
    }
  }
}
