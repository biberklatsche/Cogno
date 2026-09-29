import { Injectable } from "@angular/core";
import { NotificationTargetContract, TerminalId } from "@cogno/shared/domain";
import { PaneLayoutLookup } from "./pane-layout-lookup";

@Injectable({ providedIn: "root" })
export class NotificationTargetResolverService {
  constructor(private readonly layout: PaneLayoutLookup) {}

  resolveForTerminal(terminalId: TerminalId): NotificationTargetContract | undefined {
    const workspaceId = this.layout.findWorkspaceIdentifierByTerminalId(terminalId);
    const tabId = this.layout.findTabIdByTerminalId(terminalId);
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
