import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, ViewChild } from "@angular/core";
import { NgStyle } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";

import { SuggestionFilterMode, TerminalAutocompleteService } from "./terminal-autocomplete.service";
import { AutocompleteSuggestion } from "./autocomplete.types";
import { TooltipDirective } from "../../../../common/tooltip/tooltip.directive";
import { ActionKeybindingPipe } from "../../../../keybinding/pipe/keybinding.pipe";
import { StartEllipsisDirective } from "../../../../common/text/start-ellipsis.directive";

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
                <div class="autocomplete-list">
                    @for (item of viewState().suggestions; track item.label + ':' + $index) {
                        <button
                            [attr.data-index]="$index"
                            class="autocomplete-item"
                            [class.active]="$index === viewState().selectedIndex"
                            type="button"
                        >
                            <span
                                class="label"
                                appStartEllipsis
                                [appStartEllipsis]="item.label"
                                [appStartEllipsisMatches]="item.matchRanges"
                            ></span>
                            <span class="meta" appTooltip="{{ item.source }} &middot; {{ item.score }}">
                                <span
                                    class="source-dot"
                                    [class.history]="isHistorySuggestion(item)"
                                    [class.context]="!isHistorySuggestion(item)"
                                ></span>
                            </span>
                        </button>
                    }
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
    styles: [`
        .autocomplete-panel {
            position: fixed;
            box-sizing: border-box;
            min-width: 0;
            max-width: 920px;
            overflow: hidden;
            background: rgba(19, 29, 41, 0.97);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 8px;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
            z-index: 11;
            padding: 4px;
        }

        .autocomplete-list {
            max-height: calc(5 * 32px + 8px);
            overflow-y: auto;
            overflow-x: hidden;
        }

        .autocomplete-item {
            display: flex;
            width: 100%;
            background: transparent;
            color: var(--foreground-color);
            border: none;
            border-radius: var(--button-border-radius);
            text-align: left;
            align-items: baseline;
            justify-content: space-between;
            gap: 8px;
            min-height: 25px;
            padding: 6px 8px;
            cursor: default;
            font-family: var(--font-family);
            font-size: calc(var(--font-size) - 1px);
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
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 0.82);
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
            background: rgba(255, 255, 255, 0.22);
        }

        .autocomplete-description .description-hint .mode-badge.mode-history {
            background: var(--color-green);
        }

        .autocomplete-description .description-hint .mode-badge.mode-context {
            background: var(--color-blue);
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalAutocompleteComponent {
    @ViewChild("panel") private panelRef?: ElementRef<HTMLDivElement>;

    protected readonly viewState = toSignal(this.autocomplete.viewState$, { initialValue: {
            visible: false,
            x: 0,
            y: 0,
            width: 280,
            placement: "below",
            selectedIndex: null,
            suggestions: [],
        } });
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

    constructor(private readonly autocomplete: TerminalAutocompleteService) {
        effect(() => {
            const view = this.viewState();
            if (!view.visible || view.selectedIndex === null) return;
            queueMicrotask(() => this.scrollSelectedIntoView(view.selectedIndex!));
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
            .map(v => v.trim().toLowerCase())
            .filter(Boolean);
        return parts.some(part => part.includes("history"));
    }

    private scrollSelectedIntoView(index: number): void {
        const panel = this.panelRef?.nativeElement;
        if (!panel) return;
        const selected = panel.querySelector<HTMLButtonElement>(`.autocomplete-item[data-index="${index}"]`);
        selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
}
