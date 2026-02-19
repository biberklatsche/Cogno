import { ChangeDetectionStrategy, Component, effect, ElementRef, ViewChild } from "@angular/core";
import { NgStyle } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";

import { TerminalAutocompleteService } from "./terminal-autocomplete.service";
import { AutocompleteSuggestion } from "./autocomplete.types";
import { TooltipDirective } from "../../../../common/tooltip/tooltip.directive";

@Component({
    selector: "app-terminal-autocomplete",
    standalone: true,
    imports: [NgStyle, TooltipDirective],
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
                            (mouseenter)="preview($index)"
                            (mousedown)="apply($event, $index)"
                            type="button"
                        >
                            <span class="label">
                                @for (part of labelParts(item, viewState().width); track $index) {
                                    <span [class.match]="part.match">{{ part.text }}</span>
                                }
                            </span>
                            <span class="meta">{{ item.source }} · {{ item.score }}</span>
                        </button>
                    }
                </div>
                <div class="autocomplete-description">
                    <span class="description-text" [appTooltip]="selectedDescription()">
                        {{ selectedDescription() || ' ' }}
                    </span>
                    <span class="description-hint">
                        {{ descriptionHint() }}
                    </span>
                </div>
            </div>
        }
    `,
    styles: [`
        .autocomplete-panel {
            position: fixed;
            box-sizing: border-box;
            min-width: 160px;
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
            padding: 6px 8px;
            cursor: default;
            font-family: var(--font-family);
            font-size: calc(var(--font-size) - 1px);
        }

        .autocomplete-item.active {
            background: var(--highlight-color);
            color: var(--background-color);
        }

        .autocomplete-item .label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: clip;
            text-align: left;
        }

        .autocomplete-item .label .match {
            color: #9ddcff;
            font-weight: 700;
            text-decoration: underline;
            text-underline-offset: 2px;
        }

        .autocomplete-item .meta {
            opacity: 0.7;
            font-size: 11px;
            white-space: nowrap;
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
            opacity: 0.55;
            font-style: normal;
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalAutocompleteComponent {
    private static readonly MAX_LABEL_CHARS = 96;
    private static readonly MIN_LABEL_CHARS = 12;
    private static readonly APPROX_CHAR_PX = 8;
    private static readonly META_RESERVE_PX = 132;
    private static readonly TRUNCATION_PREFIX = "…";

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

    constructor(private readonly autocomplete: TerminalAutocompleteService) {
        effect(() => {
            const view = this.viewState();
            if (!view.visible || view.selectedIndex === null) return;
            queueMicrotask(() => this.scrollSelectedIntoView(view.selectedIndex!));
        });
    }

    protected apply(event: MouseEvent, index: number): void {
        event.preventDefault();
        event.stopPropagation();
        this.autocomplete.selectSuggestion(index);
    }

    protected preview(index: number): void {
        this.autocomplete.setSelectedIndex(index);
    }

    protected labelParts(item: AutocompleteSuggestion, panelWidth: number): Array<{ text: string; match: boolean }> {
        const { label, ranges } = this.truncateForDisplay(item, panelWidth);
        if (ranges.length === 0) return [{ text: label, match: false }];

        const parts: Array<{ text: string; match: boolean }> = [];
        let pos = 0;

        for (const range of ranges) {
            const start = Math.max(pos, Math.max(0, Math.min(range.start, label.length)));
            const end = Math.max(start, Math.max(0, Math.min(range.end, label.length)));
            if (start > pos) {
                parts.push({ text: label.slice(pos, start), match: false });
            }
            if (end > start) {
                parts.push({ text: label.slice(start, end), match: true });
            }
            pos = end;
        }

        if (pos < label.length) {
            parts.push({ text: label.slice(pos), match: false });
        }
        return parts.length > 0 ? parts : [{ text: label, match: false }];
    }

    protected selectedDescription(): string {
        const view = this.viewState();
        if (view.suggestions.length === 0) return "";
        if (view.selectedIndex === null) return "";
        const index = view.selectedIndex;
        return view.suggestions[index]?.description ?? "";
    }

    protected descriptionHint(): string {
        return this.autocomplete.descriptionHint();
    }

    private truncateForDisplay(
        item: AutocompleteSuggestion,
        panelWidth: number
    ): { label: string; ranges: Array<{ start: number; end: number }> } {
        const ranges = [...(item.matchRanges ?? [])].sort((a, b) => a.start - b.start);
        const availableLabelPx = Math.max(80, panelWidth - TerminalAutocompleteComponent.META_RESERVE_PX);
        const dynamicChars = Math.floor(availableLabelPx / TerminalAutocompleteComponent.APPROX_CHAR_PX);
        const maxChars = Math.max(
            TerminalAutocompleteComponent.MIN_LABEL_CHARS,
            Math.min(TerminalAutocompleteComponent.MAX_LABEL_CHARS, dynamicChars)
        );

        if (item.label.length <= maxChars) {
            return { label: item.label, ranges };
        }

        const prefixLength = TerminalAutocompleteComponent.TRUNCATION_PREFIX.length;
        const keep = Math.max(1, maxChars - prefixLength);
        let cutStart = Math.max(0, item.label.length - keep);
        // Preserve dotfiles when truncation starts at segment boundary (e.g. "/.nvm").
        if (
            cutStart > 1 &&
            item.label[cutStart - 1] === "." &&
            item.label[cutStart] !== "." &&
            (item.label[cutStart - 2] === "/" || item.label[cutStart - 2] === "\\")
        ) {
            cutStart -= 1;
        }
        const label = `${TerminalAutocompleteComponent.TRUNCATION_PREFIX}${item.label.slice(cutStart)}`;
        const mappedRanges = ranges
            .map(r => ({ start: r.start - cutStart + prefixLength, end: r.end - cutStart + prefixLength }))
            .map(r => ({
                start: Math.max(prefixLength, Math.min(r.start, label.length)),
                end: Math.max(prefixLength, Math.min(r.end, label.length)),
            }))
            .filter(r => r.end > r.start);

        return { label, ranges: mappedRanges };
    }

    private scrollSelectedIntoView(index: number): void {
        const panel = this.panelRef?.nativeElement;
        if (!panel) return;
        const selected = panel.querySelector<HTMLButtonElement>(`.autocomplete-item[data-index="${index}"]`);
        selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
}
