import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  viewChild,
} from "@angular/core";
import { TerminalSearchLineResultContract } from "@cogno/shared/domain";
import { SideMenuSearchInputComponent, TooltipDirective } from "@cogno/shared/ui";
import { scrollSelectedListItemIntoView } from "@cogno/shared/ui/common/navigation/scroll-selected-list-item";
import { TerminalSearchService } from "./terminal-search.service";
import { createSearchResultId } from "./terminal-search-state";

type SearchTextSegment = {
  text: string;
  isMatch: boolean;
};

@Component({
  selector: "app-terminal-search-side",
  standalone: true,
  imports: [SideMenuSearchInputComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
        <div class="search-controls">
            <app-side-menu-search-input
                class="search-input"
                placeholder="Search active terminal..."
                [value]="state().query"
                (query)="terminalSearchService.submitSearchQuery($event)"
            ></app-side-menu-search-input>
            <button
                type="button"
                class="search-option-button"
                [class.is-active]="state().caseSensitive"
                [style.background-color]="state().caseSensitive ? matchBackgroundColor() : null"
                [style.border-color]="state().caseSensitive ? matchBorderColor() : null"
                [appTooltip]="'Case sensitive'"
                (click)="$event.stopPropagation(); terminalSearchService.toggleCaseSensitive()"
            >
                Aa
            </button>
            <button
                type="button"
                class="search-option-button"
                [class.is-active]="state().regularExpression"
                [style.background-color]="state().regularExpression ? matchBackgroundColor() : null"
                [style.border-color]="state().regularExpression ? matchBorderColor() : null"
                [appTooltip]="'Regular expression'"
                (click)="$event.stopPropagation(); terminalSearchService.toggleRegularExpression()"
            >
                .*
            </button>
        </div>
        @if (isBlockSearchActive()) {
            <div class="block-search-banner">
                <span>Block search active</span>
                <button type="button" class="block-search-clear-button" (click)="$event.stopPropagation(); terminalSearchService.clearBlockSearch()">
                    Clear
                </button>
            </div>
        }

        @if (state().query.trim().length === 0) {
            <div class="helper-text">Type to search in the active terminal pane.</div>
        } @else {
            <div class="result-header">
                <span>{{ state().results.length }} matching lines</span>
                @if (state().hasMoreResults) {
                    <span>more available</span>
                }
            </div>
            @if (state().results.length > 0) {
                <ul #resultListElement class="result-list">
                    @for (searchLine of reversedSearchResults(); track trackSearchLine(searchLine)) {
                        <li
                            class="result-line"
                            [class.selected]="isSelectedSearchResult(searchLine)"
                            (click)="terminalSearchService.revealSearchResult(searchLine)"
                        >
                            <span class="line-content">
                                @for (segment of buildSegments(searchLine); track trackSegment(segment, $index)) {
                                    <span [class.match]="segment.isMatch" [style.background-color]="segment.isMatch ? matchBackgroundColor() : null" [style.border]="segment.isMatch ? '1px solid ' + matchBorderColor() : null">{{ segment.text }}</span>
                                }
                            </span>
                        </li>
                    }
                </ul>
                @if (state().hasMoreResults) {
                    <button type="button" class="load-more-button" (click)="terminalSearchService.loadMoreSearchResults()">Load more</button>
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
                flex: 1;
                min-width: 0;
            }

            .search-option-button {
                border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
                background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
                color: inherit;
                border-radius: 6px;
                height: 2rem;
                min-width: 2.25rem;
                padding: 0 0.5rem;
                font-size: 0.8rem;
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

                &:hover,
                &.selected {
                    background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
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
                border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
                background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
                color: inherit;
                border-radius: 6px;
                min-height: 2rem;
                padding: 0.35rem 0.75rem;
            }
        `,
  ],
})
export class TerminalSearchSideComponent {
  readonly state = this.terminalSearchService.state;
  readonly isBlockSearchActive = this.terminalSearchService.isBlockSearchActive;
  readonly selectedSearchResultId = this.terminalSearchService.selectedSearchResultId;
  readonly matchBackgroundColor = this.terminalSearchService.matchBackgroundColor;
  readonly matchBorderColor = this.terminalSearchService.matchBorderColor;
  /** The panel lists the results last-first: the newest line at the top. */
  readonly reversedSearchResults = computed(() => [...this.state().results].reverse());
  private readonly resultListElement = viewChild<ElementRef<HTMLUListElement>>("resultListElement");

  constructor(readonly terminalSearchService: TerminalSearchService) {
    effect(() => {
      const searchResults = this.reversedSearchResults();
      const selectedSearchResultId = this.selectedSearchResultId();
      const resultListElement = this.resultListElement()?.nativeElement;
      if (!selectedSearchResultId || searchResults.length === 0 || !resultListElement) {
        return;
      }

      const selectedIndex = searchResults.findIndex(
        (searchLine) => this.trackSearchLine(searchLine) === selectedSearchResultId,
      );
      scrollSelectedListItemIntoView(resultListElement, selectedIndex);
    });
  }

  isSelectedSearchResult(searchLine: TerminalSearchLineResultContract): boolean {
    return this.selectedSearchResultId() === this.trackSearchLine(searchLine);
  }

  trackSearchLine(searchLine: TerminalSearchLineResultContract): string {
    return createSearchResultId(searchLine);
  }

  trackSegment(segment: SearchTextSegment, index: number): string {
    return `${index}:${segment.text}:${segment.isMatch}`;
  }

  /** The line text cut at its matches, so each match is its own highlighted span. */
  buildSegments(searchLine: TerminalSearchLineResultContract): SearchTextSegment[] {
    const text = searchLine.lineText;
    const segments: SearchTextSegment[] = [];
    let index = 0;
    for (const match of searchLine.matches) {
      if (match.startIndex > index) {
        segments.push({ text: text.slice(index, match.startIndex), isMatch: false });
      }
      segments.push({ text: text.slice(match.startIndex, match.endIndex), isMatch: true });
      index = match.endIndex;
    }
    if (index < text.length || segments.length === 0) {
      segments.push({ text: text.slice(index), isMatch: false });
    }
    return segments;
  }
}
