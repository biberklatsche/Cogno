import {ChangeDetectionStrategy, Component, computed, Signal} from "@angular/core";
import {TerminalSearchLineMatchContract, TerminalSearchLineResultContract} from "@cogno/core-api";
import {TerminalSearchService} from "./terminal-search.service";

type SearchTextSegment = {
    text: string;
    isMatch: boolean;
};

@Component({
    selector: "app-terminal-search-side",
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="search-controls">
            <input
                autocomplete="off"
                spellcheck="false"
                data-private="off"
                data-side-menu-autofocus="true"
                autocorrect="off"
                type="text"
                placeholder="Search active terminal..."
                class="search-input"
                [value]="searchQuery()"
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
        @if (isBlockSearchActive()) {
            <div class="block-search-banner">
                <span>Block search active</span>
                <button type="button" class="block-search-clear-button" (click)="$event.stopPropagation(); clearBlockSearch()">
                    Clear
                </button>
            </div>
        }

        @if (searchQuery().trim().length === 0) {
            <div class="helper-text">Type to search in the active terminal pane.</div>
        } @else {
            <div class="result-header">
                <span>{{ searchResults().length }} matching lines</span>
                @if (hasMoreResults()) {
                    <span>more available</span>
                }
            </div>
            @if (searchResults().length > 0) {
                <ul class="result-list">
                    @for (searchLine of reversedSearchResults(); track trackSearchLine(searchLine)) {
                        <li class="result-line" (click)="revealSearchResult(searchLine)">
                            <span class="line-content">
                                @for (segment of buildSegments(searchLine); track trackSegment(segment, $index)) {
                                    <span [class.match]="segment.isMatch" [style.background-color]="segment.isMatch ? matchBackgroundColor() : null" [style.border]="segment.isMatch ? '1px solid ' + matchBorderColor() : null">{{ segment.text }}</span>
                                }
                            </span>
                        </li>
                    }
                </ul>
                @if (hasMoreResults()) {
                    <button type="button" class="load-more-button" (click)="loadMoreSearchResults()">Load more</button>
                }
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

            .result-header {
                display: flex;
                justify-content: space-between;
                gap: 0.5rem;
            }

            .block-search-banner {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                color: var(--highlight-color);
                font-size: 0.85rem;
                font-weight: 600;
            }

            .block-search-clear-button {
                border: 0;
                background: transparent;
                color: inherit;
                min-height: 1.7rem;
                padding: 0;
                font-size: 0.75rem;
                font-weight: 700;
                cursor: pointer;
                flex-shrink: 0;
                text-decoration: underline;
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
                display: block;
                padding: 0.35rem 0.25rem;
                border-radius: 4px;
                cursor: pointer;

                &:hover {
                    background: var(--background-color-20l);
                }
            }

            .line-content {
                display: block;
                white-space: pre-wrap;
                word-break: break-word;
                line-height: 1.3;
                font-family: monospace;
            }

            .match {
                border-radius: 2px;
            }

            .load-more-button {
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(255, 255, 255, 0.05);
                color: inherit;
                border-radius: 6px;
                min-height: 2rem;
                padding: 0.35rem 0.75rem;
                cursor: pointer;
            }
        `,
    ],
})
export class TerminalSearchSideComponent {
    readonly searchQuery: Signal<string>;
    readonly searchResults: Signal<ReadonlyArray<TerminalSearchLineResultContract>>;
    readonly caseSensitive: Signal<boolean>;
    readonly regularExpression: Signal<boolean>;
    readonly matchBackgroundColor: Signal<string>;
    readonly matchBorderColor: Signal<string>;
    readonly isBlockSearchActive: Signal<boolean>;
    readonly hasMoreResults: Signal<boolean>;
    readonly reversedSearchResults: Signal<ReadonlyArray<TerminalSearchLineResultContract>>;

    constructor(private readonly terminalSearchService: TerminalSearchService) {
        this.searchQuery = this.terminalSearchService.searchQuery;
        this.searchResults = this.terminalSearchService.searchResults;
        this.caseSensitive = this.terminalSearchService.caseSensitive;
        this.regularExpression = this.terminalSearchService.regularExpression;
        this.matchBackgroundColor = this.terminalSearchService.matchBackgroundColor;
        this.matchBorderColor = this.terminalSearchService.matchBorderColor;
        this.isBlockSearchActive = this.terminalSearchService.isBlockSearchActive;
        this.hasMoreResults = this.terminalSearchService.hasMoreResults;
        this.reversedSearchResults = computed(() => {
            return [...this.searchResults()].reverse();
        });
    }

    updateSearchQuery(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.terminalSearchService.submitSearchQuery(inputElement.value);
    }

    clearBlockSearch(): void {
        this.terminalSearchService.clearBlockSearch();
    }

    loadMoreSearchResults(): void {
        this.terminalSearchService.loadMoreSearchResults();
    }

    revealSearchResult(searchLine: TerminalSearchLineResultContract): void {
        this.terminalSearchService.revealSearchResult(searchLine);
    }

    toggleCaseSensitive(): void {
        this.terminalSearchService.toggleCaseSensitive();
    }

    toggleRegularExpression(): void {
        this.terminalSearchService.toggleRegularExpression();
    }

    trackSearchLine(searchLine: TerminalSearchLineResultContract): string {
        return `${searchLine.lineNumber}:${searchLine.lineText}`;
    }

    trackSegment(segment: SearchTextSegment, index: number): string {
        return `${index}:${segment.text}:${segment.isMatch}`;
    }

    buildSegments(searchLine: TerminalSearchLineResultContract): SearchTextSegment[] {
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
        match: TerminalSearchLineMatchContract,
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
        match: TerminalSearchLineMatchContract,
    ): void {
        segments.push({
            text: lineText.slice(match.startIndex, match.endIndex),
            isMatch: true,
        });
    }
}



