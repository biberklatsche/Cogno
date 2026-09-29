import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationTargetResolverService } from "./notification-target-resolver.service";
import type { PaneLayoutLookup } from "./pane-layout-lookup";

describe("NotificationTargetResolverService", () => {
  let layout: PaneLayoutLookup;
  let notificationTargetResolverService: NotificationTargetResolverService;

  beforeEach(() => {
    layout = {
      findWorkspaceIdentifierByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "terminal-1" ? "workspace-1" : undefined,
      ),
      findTabIdByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "terminal-1" ? "tab-1" : undefined,
      ),
    } as unknown as PaneLayoutLookup;
    notificationTargetResolverService = new NotificationTargetResolverService(layout);
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
