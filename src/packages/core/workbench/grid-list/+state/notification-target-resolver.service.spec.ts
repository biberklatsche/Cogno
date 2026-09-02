import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GridListService } from "../../grid-list/+state/grid-list.service";
import { NotificationTargetResolverService } from "./notification-target-resolver.service";

describe("NotificationTargetResolverService", () => {
  let gridListService: GridListService;
  let notificationTargetResolverService: NotificationTargetResolverService;

  beforeEach(() => {
    gridListService = {
      findWorkspaceIdentifierByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "terminal-1" ? "workspace-1" : undefined,
      ),
      findTabIdByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "terminal-1" ? "tab-1" : undefined,
      ),
    } as unknown as GridListService;
    notificationTargetResolverService = new NotificationTargetResolverService(gridListService);
  });

  it("resolves workspace, tab and terminal for known terminals", () => {
    expect(notificationTargetResolverService.resolveForTerminal("terminal-1")).toEqual({
      workspaceId: "workspace-1",
      tabId: "tab-1",
      terminalId: "terminal-1",
    });
  });

  it("returns undefined when the terminal cannot be mapped completely", () => {
    expect(
      notificationTargetResolverService.resolveForTerminal("missing-terminal"),
    ).toBeUndefined();
  });
});
