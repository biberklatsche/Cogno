import {
  TerminalSearchColorConfigContract,
  TerminalSearchPanelRequestContract,
  TerminalSearchRequestContract,
  TerminalSearchResultContract,
  TerminalSearchRevealRequestContract,
  TerminalSearchTerminalIdContract,
} from "@cogno/shared/domain";
import { Observable } from "rxjs";

/**
 * How the terminal-search feature reaches the terminal it searches: result and
 * panel-request streams to observe, and search/reveal requests to send. The API
 * owns the wiring to focus, the session facts and the config; the feature only
 * talks search (ARCHITECTURE.md 3).
 */
export abstract class TerminalSearchApi {
  abstract readonly terminalSearchResult$: Observable<TerminalSearchResultContract>;
  abstract readonly terminalSearchColorConfig$: Observable<TerminalSearchColorConfigContract>;
  abstract readonly terminalSearchPanelRequest$: Observable<TerminalSearchPanelRequestContract>;
  abstract getFocusedTerminalId(): TerminalSearchTerminalIdContract | undefined;
  abstract requestSearch(terminalSearchRequest: TerminalSearchRequestContract): void;
  abstract requestSearchDecorationClear(): void;
  abstract requestReveal(terminalSearchRevealRequest: TerminalSearchRevealRequestContract): void;
}
