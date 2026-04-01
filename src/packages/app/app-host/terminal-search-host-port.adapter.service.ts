import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";
import {
  TerminalSearchColorConfigContract,
  TerminalSearchHostPortContract,
  TerminalSearchPanelRequestContract,
  TerminalSearchRequestContract,
  TerminalSearchResultContract,
  TerminalSearchRevealRequestContract,
  TerminalSearchTerminalIdContract,
} from "@cogno/core-api";
import { AppBus } from "../app-bus/app-bus";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { ConfigService } from "../config/+state/config.service";

@Injectable({ providedIn: "root" })
export class TerminalSearchHostPortAdapterService implements TerminalSearchHostPortContract {
  readonly terminalSearchResult$: Observable<TerminalSearchResultContract>;
  readonly terminalSearchColorConfig$: Observable<TerminalSearchColorConfigContract>;
  readonly terminalSearchPanelRequest$: Observable<TerminalSearchPanelRequestContract>;

  constructor(
    private readonly appBus: AppBus,
    private readonly gridListService: GridListService,
    private readonly configService: ConfigService,
  ) {
    this.terminalSearchResult$ = this.appBus
      .on$({ path: ["app", "terminal"], type: "TerminalSearchResult" })
      .pipe(
        map((terminalSearchResultEvent) => {
          const terminalSearchResultPayload = terminalSearchResultEvent.payload;
          if (!terminalSearchResultPayload) {
            throw new Error("TerminalSearchResult payload must be defined.");
          }
          return terminalSearchResultPayload;
        }),
      );

    this.terminalSearchColorConfig$ = this.configService.config$.pipe(
      map((configuration) => ({
        matchBackgroundColor: configuration.search?.match?.background_color,
        matchBorderColor: configuration.search?.match?.border_color,
      })),
    );

    this.terminalSearchPanelRequest$ = this.appBus
      .on$({ path: ["app", "terminal"], type: "TerminalSearchPanelRequested" })
      .pipe(
        map((terminalSearchPanelRequestedEvent) => {
          if (!terminalSearchPanelRequestedEvent.payload) {
            throw new Error("TerminalSearchPanelRequested payload must be defined.");
          }
          return terminalSearchPanelRequestedEvent.payload;
        }),
      );
  }

  getFocusedTerminalId(): TerminalSearchTerminalIdContract | undefined {
    return this.gridListService.getFocusedTerminalId();
  }

  requestSearch(terminalSearchRequest: TerminalSearchRequestContract): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRequested",
      payload: terminalSearchRequest,
    });
  }

  requestSearchDecorationClear(): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRequested",
      payload: {
        query: "",
        caseSensitive: false,
        regularExpression: false,
      },
    });
  }

  requestReveal(terminalSearchRevealRequest: TerminalSearchRevealRequestContract): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchRevealRequested",
      payload: terminalSearchRevealRequest,
    });
  }
}



