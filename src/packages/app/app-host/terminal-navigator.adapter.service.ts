import { Injectable } from "@angular/core";
import { TerminalGateway, TerminalNavigator } from "@cogno/core-api";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { TabListService } from "../tab-list/+state/tab-list.service";

@Injectable({ providedIn: "root" })
export class TerminalNavigatorAdapterService extends TerminalNavigator {
  constructor(
    private readonly gridListService: GridListService,
    private readonly tabListService: TabListService,
    private readonly terminalGateway: TerminalGateway,
  ) {
    super();
  }

  navigateToTerminal(terminalId: string): void {
    const tabId = this.gridListService.findTabIdByTerminalId(terminalId);
    if (tabId) {
      this.tabListService.selectTab(tabId);
    }
    this.terminalGateway.focusTerminal(terminalId);
  }
}
