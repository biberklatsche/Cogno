import type {
  TerminalSearchColorConfigContract,
  TerminalSearchPanelRequestContract,
  TerminalSearchRequestContract,
  TerminalSearchResultContract,
  TerminalSearchRevealRequestContract,
  TerminalSearchTerminalIdContract,
} from "@cogno/shared/domain";
import { Observable } from "rxjs";

export interface TerminalSearchHostPortContract {
  readonly terminalSearchResult$: Observable<TerminalSearchResultContract>;
  readonly terminalSearchColorConfig$: Observable<TerminalSearchColorConfigContract>;
  readonly terminalSearchPanelRequest$: Observable<TerminalSearchPanelRequestContract>;
  getFocusedTerminalId(): TerminalSearchTerminalIdContract | undefined;
  requestSearch(terminalSearchRequest: TerminalSearchRequestContract): void;
  requestSearchDecorationClear(): void;
  requestReveal(terminalSearchRevealRequest: TerminalSearchRevealRequestContract): void;
}

export abstract class TerminalSearchHostPort implements TerminalSearchHostPortContract {
  abstract readonly terminalSearchResult$: Observable<TerminalSearchResultContract>;
  abstract readonly terminalSearchColorConfig$: Observable<TerminalSearchColorConfigContract>;
  abstract readonly terminalSearchPanelRequest$: Observable<TerminalSearchPanelRequestContract>;
  abstract getFocusedTerminalId(): TerminalSearchTerminalIdContract | undefined;
  abstract requestSearch(terminalSearchRequest: TerminalSearchRequestContract): void;
  abstract requestSearchDecorationClear(): void;
  abstract requestReveal(terminalSearchRevealRequest: TerminalSearchRevealRequestContract): void;
}
