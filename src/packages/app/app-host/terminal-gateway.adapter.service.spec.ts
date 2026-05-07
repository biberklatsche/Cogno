import { TauriPty } from "@cogno/app-tauri/pty";
import { firstValueFrom } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../app-bus/app-bus";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { TerminalSessionRegistry } from "../terminal/+state/terminal-session.registry";
import { TerminalGatewayAdapterService } from "./terminal-gateway.adapter.service";

describe("TerminalGatewayAdapterService", () => {
  let appBus: AppBus;
  let gridListService: Pick<
    GridListService,
    "getFocusedTerminalId" | "findTabIdByTerminalId" | "findWorkspaceIdentifierByTerminalId"
  >;
  let terminalSessionRegistry: Pick<TerminalSessionRegistry, "get" | "has">;
  let service: TerminalGatewayAdapterService;

  beforeEach(() => {
    appBus = new AppBus();
    gridListService = {
      getFocusedTerminalId: vi.fn().mockReturnValue("terminal-1"),
      findTabIdByTerminalId: vi.fn().mockReturnValue("tab-1"),
      findWorkspaceIdentifierByTerminalId: vi.fn().mockReturnValue("workspace-1"),
    };
    terminalSessionRegistry = {
      has: vi.fn().mockReturnValue(true),
      get: vi.fn().mockReturnValue({
        session: {
          getRecentOutputSnapshot: vi.fn().mockReturnValue("recent output"),
          getLatestCommandOutputSnapshot: vi.fn().mockReturnValue("latest output"),
        },
        stateManager: {
          state: {
            shellContext: { shellType: "Bash" },
            cwd: "/workspace",
            input: { text: "pwd" },
            isCommandRunning: true,
          },
          commands: [
            {
              id: "command-1",
              command: "pwd",
              directory: "/workspace",
              duration: 10,
              returnCode: 0,
            },
          ],
        },
      }),
    };
    service = new TerminalGatewayAdapterService(
      appBus,
      gridListService as GridListService,
      terminalSessionRegistry as TerminalSessionRegistry,
    );
  });

  it("publishes terminal focus and input events", () => {
    const publishSpy = vi.spyOn(appBus, "publish");

    service.focusTerminal("terminal-2");
    service.injectInput({ terminalId: "terminal-2", text: "ls\n" });

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["app", "terminal"],
        type: "FocusTerminal",
        payload: "terminal-2",
      }),
    );
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["app", "terminal"],
        type: "InjectTerminalInput",
        payload: { terminalId: "terminal-2", text: "ls\n" },
      }),
    );
  });

  it("exposes busy and focus streams from the app bus", async () => {
    const focusedTerminalIdPromise = firstValueFrom(service.focusedTerminalId$);
    const busyStatePromise = firstValueFrom(service.busyStateChanges$);

    appBus.publish({ path: ["app", "terminal"], type: "FocusTerminal", payload: "terminal-3" });
    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalBusyChanged",
      payload: { terminalId: "terminal-3", isBusy: true },
    });

    await expect(focusedTerminalIdPromise).resolves.toBe("terminal-3");
    await expect(busyStatePromise).resolves.toEqual({
      terminalId: "terminal-3",
      isBusy: true,
    });
  });

  it("captures focused terminal snapshots with optional process info", async () => {
    vi.spyOn(TauriPty, "getProcessTreeByTerminalId").mockResolvedValue({
      rootProcess: {
        processId: 42,
        name: "bash",
        currentWorkingDirectory: "/workspace",
      },
    });

    await expect(
      service.captureFocusedSnapshot({
        includeProcessSummary: true,
        maxCommands: 1,
        maxOutputChars: 500,
      }),
    ).resolves.toEqual({
      terminalId: "terminal-1",
      tabId: "tab-1",
      workspaceId: "workspace-1",
      shellType: "Bash",
      cwd: "/workspace",
      input: "pwd",
      isCommandRunning: true,
      commands: [
        {
          id: "command-1",
          text: "pwd",
          cwd: "/workspace",
          durationMs: 10,
          returnCode: 0,
        },
      ],
      lastOutput: "recent output",
      latestCommandOutput: "latest output",
      process: {
        processId: 42,
        name: "bash",
        cwd: "/workspace",
      },
    });
  });

  it("returns undefined when no focused terminal or session exists", async () => {
    vi.mocked(gridListService.getFocusedTerminalId).mockReturnValue(undefined);
    await expect(service.captureFocusedSnapshot()).resolves.toBeUndefined();

    vi.mocked(gridListService.getFocusedTerminalId).mockReturnValue("missing");
    vi.mocked(terminalSessionRegistry.get).mockReturnValue(undefined);
    await expect(service.captureSnapshot("missing")).resolves.toBeUndefined();
  });

  it("reports terminal presence from the registry", () => {
    expect(service.getFocusedTerminalId()).toBe("terminal-1");
    expect(service.hasTerminal("terminal-1")).toBe(true);
  });
});
