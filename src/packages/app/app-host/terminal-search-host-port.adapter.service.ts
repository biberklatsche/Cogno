import { DestroyRef, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";
import {
  TerminalSearchColorConfigContract,
  TerminalSearchHostPortContract,
  TerminalSearchRequestContract,
  TerminalSearchResultContract,
  TerminalSearchRevealRequestContract,
  TerminalSearchTerminalIdContract,
} from "@cogno/core-sdk";
import { AppBus } from "../app-bus/app-bus";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { ConfigService } from "../config/+state/config.service";

@Injectable({ providedIn: "root" })
export class TerminalSearchHostPortAdapterService implements TerminalSearchHostPortContract {
  readonly terminalSearchResult$: Observable<TerminalSearchResultContract>;
  readonly terminalSearchColorConfig$: Observable<TerminalSearchColorConfigContract>;

  constructor(
    private readonly appBus: AppBus,
    private readonly gridListService: GridListService,
    private readonly configService: ConfigService,
    private readonly destroyRef: DestroyRef,
  ) {
    void this.destroyRef;

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
