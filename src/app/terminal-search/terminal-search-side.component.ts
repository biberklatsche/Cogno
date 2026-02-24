import {ChangeDetectionStrategy, Component, Signal, inject} from "@angular/core";
import {AutofocusDirective} from "../common/autofocus/autofocus.directive";
import {TerminalSearchLineMatch, TerminalSearchLineResult} from "../terminal/+bus/events";
import {TerminalSearchService} from "./terminal-search.service";

type SearchTextSegment = {
    text: string;
    isMatch: boolean;
};

@Component({
    selector: "app-terminal-search-side",
    standalone: true,
    imports: [AutofocusDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="search-controls">
            <input
                autocomplete="off"
                spellcheck="false"
                data-private="off"
                autocorrect="off"
                type="text"
                placeholder="Search active terminal..."
                class="search-input"
                [value]="searchQuery()"
                [appAutofocus]="true"
                (input)="updateSearchQuery($event)"
                (click)="$event.stopPropagation()"
            />
            <button
                type="button"
                class="search-option-button"
                [class.is-active]="caseSensitive()"
                [style.background-color]="caseSensitive() ? matchBackgroundColor() : null"
                [style.border-color]="caseSensitive() ? matchBorderColor() : null"
                title="Case sensitive"
                (click)="$event.stopPropagation(); toggleCaseSensitive()"
            >
                Aa
            </button>
            <button
                type="button"
                class="search-option-button"
                [class.is-active]="regularExpression()"
                [style.background-color]="regularExpression() ? matchBackgroundColor() : null"
                [style.border-color]="regularExpression() ? matchBorderColor() : null"
                title="Regular expression"
                (click)="$event.stopPropagation(); toggleRegularExpression()"
            >
                .*
            </button>
        </div>

        @if (searchQuery().trim().length === 0) {
            <div class="helper-text">Type to search in the active terminal pane.</div>
        } @else {
            <div class="result-header">{{ searchResults().length }} matching lines</div>
            @if (searchResults().length > 0) {
                <ul class="result-list">
                    @for (searchLine of searchResults().reverse(); track trackSearchLine(searchLine)) {
                        <li class="result-line" (click)="revealSearchResult(searchLine)">
                            <span class="line-number">{{ searchLine.lineNumber }}</span>
                            <span class="line-content">
                                @for (segment of buildSegments(searchLine); track trackSegment(segment, $index)) {
                                    <span [class.match]="segment.isMatch" [style.background-color]="segment.isMatch ? matchBackgroundColor() : null" [style.border]="segment.isMatch ? '1px solid ' + matchBorderColor() : null">{{ segment.text }}</span>
                                }
                            </span>
                        </li>
                    }
                </ul>
            } @else {
                <div class="helper-text">No matches</div>
            }
        }
    `,
    styles: [
        `
            :host {
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow: hidden;
                gap: 0.5rem;
            }

            .search-controls {
                display: flex;
                align-items: center;
                gap: 0.35rem;
            }

            .search-input {
                padding: 6px 8px;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                background: rgba(255, 255, 255, 0.04);
                color: inherit;
                outline: none;
                box-sizing: border-box;
                flex: 1;
                min-width: 0;
            }

            .search-option-button {
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(255, 255, 255, 0.05);
                color: inherit;
                border-radius: 6px;
                height: 2rem;
                min-width: 2.25rem;
                padding: 0 0.5rem;
                font-size: 0.8rem;
                cursor: pointer;
            }

            .search-option-button.is-active {
                font-weight: 600;
            }

            .result-header,
            .helper-text {
                font-size: 0.85rem;
                opacity: 0.7;
            }

            .result-list {
                list-style: none;
                margin: 0;
                padding: 0;
                overflow: auto;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .result-line {
                display: grid;
                grid-template-columns: 3.25rem 1fr;
                gap: 0.75rem;
                align-items: flex-start;
                padding: 0.35rem 0.25rem;
                border-radius: 4px;
                cursor: pointer;

                &:hover {
                    background: var(--background-color-20l);
                }
            }

            .line-number {
                font-family: monospace;
                opacity: 0.6;
                user-select: none;
            }

            .line-content {
                white-space: pre-wrap;
                word-break: break-word;
                line-height: 1.3;
                font-family: monospace;
            }

            .match {
                border-radius: 2px;
            }
        `,
    ],
})
export class TerminalSearchSideComponent {
    private readonly terminalSearchService = inject(TerminalSearchService);

    readonly searchQuery: Signal<string>;
    readonly searchResults: Signal<TerminalSearchLineResult[]>;
    readonly caseSensitive: Signal<boolean>;
    readonly regularExpression: Signal<boolean>;
    readonly matchBackgroundColor: Signal<string>;
    readonly matchBorderColor: Signal<string>;

    constructor() {
        this.searchQuery = this.terminalSearchService.searchQuery;
        this.searchResults = this.terminalSearchService.searchResults;
        this.caseSensitive = this.terminalSearchService.caseSensitive;
        this.regularExpression = this.terminalSearchService.regularExpression;
        this.matchBackgroundColor = this.terminalSearchService.matchBackgroundColor;
        this.matchBorderColor = this.terminalSearchService.matchBorderColor;
    }

    updateSearchQuery(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.terminalSearchService.submitSearchQuery(inputElement.value);
    }

    revealSearchResult(searchLine: TerminalSearchLineResult): void {
        this.terminalSearchService.revealSearchResult(searchLine);
    }

    toggleCaseSensitive(): void {
        this.terminalSearchService.toggleCaseSensitive();
    }

    toggleRegularExpression(): void {
        this.terminalSearchService.toggleRegularExpression();
    }

    trackSearchLine(searchLine: TerminalSearchLineResult): string {
        return `${searchLine.lineNumber}:${searchLine.lineText}`;
    }

    trackSegment(segment: SearchTextSegment, index: number): string {
        return `${index}:${segment.text}:${segment.isMatch}`;
    }

    buildSegments(searchLine: TerminalSearchLineResult): SearchTextSegment[] {
        if (searchLine.matches.length === 0) {
            return [{text: searchLine.lineText, isMatch: false}];
        }

        const segments: SearchTextSegment[] = [];
        let currentIndex = 0;

        for (const match of searchLine.matches) {
            this.appendTextBeforeMatch(segments, searchLine.lineText, currentIndex, match);
            this.appendMatchedText(segments, searchLine.lineText, match);
            currentIndex = match.endIndex;
        }

        if (currentIndex < searchLine.lineText.length) {
            segments.push({
                text: searchLine.lineText.slice(currentIndex),
                isMatch: false,
            });
        }

        return segments;
    }

    private appendTextBeforeMatch(
        segments: SearchTextSegment[],
        lineText: string,
        currentIndex: number,
        match: TerminalSearchLineMatch,
    ): void {
        if (match.startIndex <= currentIndex) {
            return;
        }

        segments.push({
            text: lineText.slice(currentIndex, match.startIndex),
            isMatch: false,
        });
    }

    private appendMatchedText(
        segments: SearchTextSegment[],
        lineText: string,
        match: TerminalSearchLineMatch,
    ): void {
        segments.push({
            text: lineText.slice(match.startIndex, match.endIndex),
            isMatch: true,
        });
    }
}
