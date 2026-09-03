import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import {
  TerminalSearchColorConfigContract,
  TerminalSearchPanelRequestContract,
  TerminalSearchRequestContract,
  TerminalSearchResultContract,
  TerminalSearchRevealRequestContract,
  TerminalSearchTerminalIdContract,
} from "@cogno/shared/domain";
import { TerminalSearchHostPortContract } from "@cogno/shared/ports";
import { filter, map, Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class TerminalSearchHostPortAdapterService implements TerminalSearchHostPortContract {
  readonly terminalSearchResult$: Observable<TerminalSearchResultContract>;
  readonly terminalSearchColorConfig$: Observable<TerminalSearchColorConfigContract>;
  readonly terminalSearchPanelRequest$: Observable<TerminalSearchPanelRequestContract>;

  constructor(
    private readonly appBus: AppBus,
    private readonly gridListService: GridListService,
    private readonly configService: ConfigService,
    sessionRegistry: TerminalSessionRegistry,
  ) {
    this.terminalSearchResult$ = sessionRegistry.facts$.pipe(
      filter(({ fact }) => fact.type === "searchResult"),
      map(
        ({ fact }) =>
          (fact as { type: "searchResult"; result: TerminalSearchResultContract }).result,
      ),
    );

    this.terminalSearchColorConfig$ = this.configService.config$.pipe(
      map((configuration) => ({
        matchBackgroundColor: configuration.terminal?.decoration?.color?.background,
        matchBorderColor: configuration.terminal?.decoration?.color?.border,
      })),
    );

    // A block filter both opens the search panel and carries the block range.
    sessionRegistry.facts$
      .pipe(filter(({ fact }) => fact.type === "filterBlockRequested"))
      .subscribe(() => this.appBus.publish(ActionFired.create("open_terminal_search")));

    this.terminalSearchPanelRequest$ = sessionRegistry.facts$.pipe(
      filter(({ fact }) => fact.type === "filterBlockRequested"),
      map(({ terminalId, fact }) => {
        const range = (
          fact as {
            type: "filterBlockRequested";
            range: { beginBufferLine: number; endBufferLine: number };
          }
        ).range;
        return {
          terminalId,
          beginBufferLine: range.beginBufferLine,
          endBufferLine: range.endBufferLine,
        };
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
