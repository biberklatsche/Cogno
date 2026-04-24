import { Injectable } from "@angular/core";
import { NotificationTargetContract } from "@cogno/core-api";
import { TerminalId } from "../../grid-list/+model/model";
import { GridListService } from "../../grid-list/+state/grid-list.service";

@Injectable({ providedIn: "root" })
export class NotificationTargetResolverService {
  constructor(private readonly gridListService: GridListService) {}

  resolveForTerminal(terminalId: TerminalId): NotificationTargetContract | undefined {
    const workspaceId = this.gridListService.findWorkspaceIdentifierByTerminalId(terminalId);
    const tabId = this.gridListService.findTabIdByTerminalId(terminalId);
    if (!workspaceId || !tabId) {
      return undefined;
    }

    return {
      workspaceId,
      tabId,
      terminalId,
    };
  }
}
