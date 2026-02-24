import {DestroyRef, Injectable, Signal, inject, signal} from "@angular/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {AppBus} from "../app-bus/app-bus";
import {GridListService} from "../grid-list/+state/grid-list.service";
import {
    TerminalSearchLineResult,
    TerminalSearchRevealPayload,
    TerminalSearchResultEvent,
} from "../terminal/+bus/events";
import {FeatureMode} from "../config/+models/config";
import {ConfigService} from "../config/+state/config.service";
import {SideMenuService} from "../menu/side-menu/+state/side-menu.service";
import {KeybindService} from "../keybinding/keybind.service";
import {createSideMenuFeature, SideMenuFeature} from "../menu/side-menu/+state/side-menu-feature";
import {TerminalId} from "../grid-list/+model/model";
import {TerminalSearchSideComponent} from "./terminal-search-side.component";

@Injectable({providedIn: "root"})
export class TerminalSearchService {
    private readonly sideMenuService = inject(SideMenuService);
    private readonly appBus = inject(AppBus);
    private readonly gridListService = inject(GridListService);
    private readonly configService = inject(ConfigService);
    private readonly keybindService = inject(KeybindService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly feature: SideMenuFeature;

    private readonly searchQuerySignal = signal<string>("");
    private readonly searchResultsSignal = signal<TerminalSearchLineResult[]>([]);
    private readonly caseSensitiveSignal = signal<boolean>(false);
    private readonly regularExpressionSignal = signal<boolean>(false);
    private readonly matchBackgroundColorSignal = signal<string>("");
    private readonly matchBorderColorSignal = signal<string>("");
    private readonly activeTerminalIdSignal = signal<TerminalId | undefined>(undefined);

    readonly searchQuery: Signal<string> = this.searchQuerySignal.asReadonly();
    readonly searchResults: Signal<TerminalSearchLineResult[]> = this.searchResultsSignal.asReadonly();
    readonly caseSensitive: Signal<boolean> = this.caseSensitiveSignal.asReadonly();
    readonly regularExpression: Signal<boolean> = this.regularExpressionSignal.asReadonly();
    readonly matchBackgroundColor: Signal<string> = this.matchBackgroundColorSignal.asReadonly();
    readonly matchBorderColor: Signal<string> = this.matchBorderColorSignal.asReadonly();

    constructor() {
        this.feature = createSideMenuFeature(
            {
                label: "Terminal Search",
                icon: "mdiFormatLetterMatches",
                actionName: "open_terminal_search",
                component: TerminalSearchSideComponent,
                configPath: "terminal_search",
            },
            {
                onModeChange: (mode: FeatureMode) => this.handleModeChange(mode),
                onOpen: () => this.handleOpen(),
                onFocus: () => this.registerKeybindListener(),
                onBlur: () => this.unregisterKeybindListener(),
                onClose: () => this.handleClose(),
            },
            {
                sideMenuService: this.sideMenuService,
                bus: this.appBus,
                configService: this.configService,
                keybinds: this.keybindService,
                destroyRef: this.destroyRef
            }
        );

        this.appBus
            .on$({path: ["app", "terminal"], type: "TerminalSearchResult"})
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((event: TerminalSearchResultEvent) => {
                this.handleSearchResult(event);
            });

        this.configService.config$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((config) => {
                this.updateSearchColors(config.terminal_search?.match_background_color, config.terminal_search?.match_border_color);
            });
    }

    submitSearchQuery(query: string): void {
        this.searchQuerySignal.set(query);
        this.searchInActiveTerminal(query);
    }

    repeatSearch(): void {
        this.searchInActiveTerminal(this.searchQuerySignal());
    }

    toggleCaseSensitive(): void {
        this.caseSensitiveSignal.update((isCaseSensitive: boolean) => !isCaseSensitive);
        this.repeatSearch();
    }

    toggleRegularExpression(): void {
        this.regularExpressionSignal.update((isRegularExpressionEnabled: boolean) => !isRegularExpressionEnabled);
        this.repeatSearch();
    }

    revealSearchResult(searchLine: TerminalSearchLineResult): void {
        const activeTerminalId = this.activeTerminalIdSignal();
        if (!activeTerminalId) {
            return;
        }

        const firstLineMatch = searchLine.matches.at(0);
        if (!firstLineMatch) {
            return;
        }

        const revealPayload: TerminalSearchRevealPayload = {
            terminalId: activeTerminalId,
            query: this.searchQuerySignal().trim(),
            caseSensitive: this.caseSensitiveSignal(),
            regularExpression: this.regularExpressionSignal(),
            lineNumber: searchLine.lineNumber,
            matchStartIndex: firstLineMatch.startIndex,
            matchLength: firstLineMatch.endIndex - firstLineMatch.startIndex,
        };

        this.appBus.publish({
            path: ["app", "terminal"],
            type: "TerminalSearchRevealRequested",
            payload: revealPayload,
        });
    }

    closeSearch(): void {
        this.feature.close();
    }

    private handleModeChange(mode: FeatureMode): void {
        if (mode === "off") {
            this.handleClose();
        }
    }

    private handleOpen(): void {
        this.registerKeybindListener();
        const currentQuery = this.searchQuerySignal();
        if (currentQuery.length > 0) {
            this.searchInActiveTerminal(currentQuery);
        }
    }

    private handleClose(): void {
        this.unregisterKeybindListener();
        this.clearDecorationsInAllTerminals();
        this.searchQuerySignal.set("");
        this.searchResultsSignal.set([]);
        this.caseSensitiveSignal.set(false);
        this.regularExpressionSignal.set(false);
        this.activeTerminalIdSignal.set(undefined);
    }

    private registerKeybindListener(): void {
        this.feature.registerKeybindListener(["Escape", "Enter"], (keyboardEvent: KeyboardEvent) => {
            if (keyboardEvent.key === "Escape") {
                this.feature.close();
                return;
            }
            if (keyboardEvent.key === "Enter") {
                this.repeatSearch();
            }
        });
    }

    private unregisterKeybindListener(): void {
        this.feature.unregisterKeybindListener();
    }

    private searchInActiveTerminal(query: string): void {
        const activeTerminalId = this.gridListService.getFocusedTerminalId();
        this.activeTerminalIdSignal.set(activeTerminalId);

        if (!activeTerminalId) {
            this.searchResultsSignal.set([]);
            return;
        }

        this.appBus.publish({
            path: ["app", "terminal"],
            type: "TerminalSearchRequested",
            payload: {
                terminalId: activeTerminalId,
                query,
                caseSensitive: this.caseSensitiveSignal(),
                regularExpression: this.regularExpressionSignal(),
            }
        });
    }

    private clearDecorationsInAllTerminals(): void {
        this.appBus.publish({
            path: ["app", "terminal"],
            type: "TerminalSearchRequested",
            payload: {
                query: "",
                caseSensitive: false,
                regularExpression: false,
            }
        });
    }

    private handleSearchResult(event: TerminalSearchResultEvent): void {
        const payload = event.payload;
        if (!payload) {
            return;
        }

        if (payload.terminalId !== this.activeTerminalIdSignal()) {
            return;
        }

        if (payload.query !== this.searchQuerySignal().trim()) {
            return;
        }

        if (payload.caseSensitive !== this.caseSensitiveSignal()) {
            return;
        }

        if (payload.regularExpression !== this.regularExpressionSignal()) {
            return;
        }

        this.searchResultsSignal.set(payload.lines);
    }

    private updateSearchColors(matchBackgroundColor?: string, matchBorderColor?: string): void {
        this.matchBackgroundColorSignal.set(this.toCssColor(matchBackgroundColor));
        this.matchBorderColorSignal.set(this.toCssColor(matchBorderColor));
    }

    private toCssColor(hexColor?: string): string {
        if (!hexColor) {
            return "";
        }
        return `#${hexColor}`;
    }
}
