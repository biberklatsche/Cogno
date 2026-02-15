import { ChangeDetectionStrategy, Component, effect, ElementRef, ViewChild } from "@angular/core";
import { NgStyle } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";

import { TerminalAutocompleteService } from "./terminal-autocomplete.service";
import { AutocompleteSuggestion } from "./autocomplete.types";

@Component({
    selector: "app-terminal-autocomplete",
    standalone: true,
    imports: [NgStyle],
    template: `
        @if (viewState().visible) {
            <div
                #panel
                class="autocomplete-panel"
                [ngStyle]="{ left: viewState().x + 'px', top: viewState().y + 'px' }"
            >
                @for (item of viewState().suggestions; track item.label + ':' + $index) {
                    <button
                        [attr.data-index]="$index"
                        class="autocomplete-item"
                        [class.active]="$index === viewState().selectedIndex"
                        (mousedown)="apply($event, $index)"
                        type="button"
                    >
                        <span class="label">
                            @for (part of labelParts(item); track $index) {
                                <span [class.match]="part.match">{{ part.text }}</span>
                            }
                        </span>
                        <span class="meta">{{ item.source }} · {{ item.score }}</span>
                    </button>
                }
            </div>
        }
    `,
    styles: [`
        .autocomplete-panel {
            position: fixed;
            width: clamp(220px, 55%, 760px);
            max-width: calc(100% - 8px);
            max-height: calc(5 * 32px + 8px);
            overflow-y: auto;
            overflow-x: hidden;
            background: rgba(19, 29, 41, 0.97);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 8px;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
            z-index: 11;
            padding: 4px;
        }

        .autocomplete-item {
            display: flex;
            width: 100%;
            min-height: 32px;
            background: transparent;
            color: var(--foreground-color);
            border: none;
            border-radius: 6px;
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
            background: rgba(52, 187, 254, 0.22);
        }

        .autocomplete-item .label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
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
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalAutocompleteComponent {
    private static readonly MAX_LABEL_CHARS = 72;

    @ViewChild("panel") private panelRef?: ElementRef<HTMLDivElement>;

    protected readonly viewState = toSignal(this.autocomplete.viewState$, { initialValue: {
            visible: false,
            x: 0,
            y: 0,
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

    protected labelParts(item: AutocompleteSuggestion): Array<{ text: string; match: boolean }> {
        const { label, ranges } = this.truncateForDisplay(item);
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

    private truncateForDisplay(item: AutocompleteSuggestion): { label: string; ranges: Array<{ start: number; end: number }> } {
        const ranges = [...(item.matchRanges ?? [])].sort((a, b) => a.start - b.start);
        if (item.label.length <= TerminalAutocompleteComponent.MAX_LABEL_CHARS) {
            return { label: item.label, ranges };
        }

        const keep = TerminalAutocompleteComponent.MAX_LABEL_CHARS - 3;
        const cutStart = Math.max(0, item.label.length - keep);
        const label = `...${item.label.slice(cutStart)}`;
        const mappedRanges = ranges
            .map(r => ({ start: r.start - cutStart + 3, end: r.end - cutStart + 3 }))
            .map(r => ({
                start: Math.max(3, Math.min(r.start, label.length)),
                end: Math.max(3, Math.min(r.end, label.length)),
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
