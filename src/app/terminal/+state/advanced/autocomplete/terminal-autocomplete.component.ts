import { ChangeDetectionStrategy, Component, effect, ElementRef, ViewChild } from "@angular/core";
import { NgStyle } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";

import { TerminalAutocompleteService } from "./terminal-autocomplete.service";

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
                        <span class="label">{{ item.label }}</span>
                        <span class="meta">{{ item.source }} · {{ item.score }}</span>
                    </button>
                }
            </div>
        }
    `,
    styles: [`
        .autocomplete-panel {
            position: absolute;
            width: clamp(180px, 45%, 560px);
            max-width: calc(100% - 8px);
            max-height: calc(5 * 32px + 8px);
            overflow-y: auto;
            overflow-x: hidden;
            background: rgba(19, 29, 41, 0.97);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 8px;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
            z-index: 1500;
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

    private scrollSelectedIntoView(index: number): void {
        const panel = this.panelRef?.nativeElement;
        if (!panel) return;
        const selected = panel.querySelector<HTMLButtonElement>(`.autocomplete-item[data-index="${index}"]`);
        selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
}
