import { TerminalGatewayService } from "@cogno/core/api/terminal-gateway.service";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TauriPty } from "@cogno/platform/pty";
import { CommandRunner } from "@cogno/shared/ports";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("TerminalGatewayService", () => {
  let appBus: AppBus;
  let gridListService: Pick<
    GridListService,
    "getFocusedTerminalId" | "findTabIdByTerminalId" | "findWorkspaceIdentifierByTerminalId"
  >;
  let terminalSessionRegistry: Pick<TerminalSessionRegistry, "get" | "has">;
  let commandRunner: Pick<CommandRunner, "run">;
  let service: TerminalGatewayService;

  beforeEach(() => {
    appBus = new AppBus();
    commandRunner = {
      run: vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 }),
    };
    gridListService = {
      getFocusedTerminalId: vi.fn().mockReturnValue("terminal-1"),
      findTabIdByTerminalId: vi.fn().mockReturnValue("tab-1"),
      findWorkspaceIdentifierByTerminalId: vi.fn().mockReturnValue("workspace-1"),
    };
    terminalSessionRegistry = {
      has: vi.fn().mockReturnValue(true),
      get: vi.fn().mockReturnValue({
        host: {
          runtime$: new BehaviorSubject({ status: "running" }),
          getRecentOutputSnapshot: vi.fn().mockReturnValue("recent output"),
          getLatestCommandOutputSnapshot: vi.fn().mockReturnValue("latest output"),
          state: {
            shellContext: { shellType: "Bash", backendOs: "linux" },
            cwd: "/workspace",
            input: { text: "pwd" },
            isCommandRunning: true,
            contextRevision: 3,
            isContextKnown: true,
          },
          model: {
            sessionToken: "token-1",
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
        },
      }),
    };
    service = new TerminalGatewayService(
      appBus,
      gridListService as GridListService,
      terminalSessionRegistry as TerminalSessionRegistry,
      commandRunner as CommandRunner,
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
        type: "WriteRawToPty",
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
      shellContext: { shellType: "Bash", backendOs: "linux" },
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

  describe("write protection", () => {
    function bindTo(terminalId: string): void {
      appBus.publish({ path: ["app", "terminal"], type: "FocusTerminal", payload: terminalId });
    }

    it("writes when the identity still matches the bound session", () => {
      bindTo("t1");
      const publishSpy = vi.spyOn(appBus, "publish");

      service.injectInput(
        { terminalId: "t1", text: "ls\n" },
        { terminalId: "t1", sessionToken: "token-1" },
      );

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "WriteRawToPty",
          payload: { terminalId: "t1", text: "ls\n" },
        }),
      );
    });

    it("rejects a stale identity after focus moved, and writes nothing", () => {
      bindTo("t1");
      const identityForT1 = { terminalId: "t1", sessionToken: "token-1" };
      bindTo("t2");
      const publishSpy = vi.spyOn(appBus, "publish");

      service.injectInput({ terminalId: "t1", text: "rm -rf /\n" }, identityForT1);

      expect(publishSpy).not.toHaveBeenCalled();
    });

    it("rejects a write whose token no longer matches the live session", () => {
      bindTo("t1");
      const publishSpy = vi.spyOn(appBus, "publish");

      service.injectInput(
        { terminalId: "t1", text: "x\n" },
        { terminalId: "t1", sessionToken: "stale-token" },
      );

      expect(publishSpy).not.toHaveBeenCalled();
    });

    it("still writes fire-and-forget when no identity is given (legacy path)", () => {
      const publishSpy = vi.spyOn(appBus, "publish");

      service.injectInput({ terminalId: "t9", text: "echo hi\n" });

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "WriteRawToPty" }));
    });
  });

  describe("context-bound run", () => {
    const identity = { terminalId: "t1", sessionToken: "token-1" };

    function bindWith(stateOverrides: Record<string, unknown>): void {
      vi.mocked(terminalSessionRegistry.get).mockReturnValue({
        host: {
          runtime$: new BehaviorSubject({ status: "running" }),
          model: { sessionToken: "token-1" },
          state: {
            shellContext: { shellType: "Bash", backendOs: "linux" },
            cwd: "/workspace",
            input: { text: "" },
            isCommandRunning: false,
            contextRevision: 3,
            isContextKnown: true,
            ...stateOverrides,
          },
        },
      } as unknown as ReturnType<TerminalSessionRegistry["get"]>);
      appBus.publish({ path: ["app", "terminal"], type: "FocusTerminal", payload: "t1" });
    }

    it("runs a local command in the session cwd", async () => {
      bindWith({});

      const runResult = await service.run(
        { executable: "git", args: ["status"], contextRevision: 3 },
        identity,
      );

      expect(runResult).toEqual({
        status: "ran",
        result: { stdout: "ok", stderr: "", exitCode: 0 },
      });
      expect(commandRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: "/workspace",
          program: "git",
          args: ["status"],
          shellContext: { shellType: "Bash", backendOs: "linux" },
        }),
      );
    });

    it("runs a WSL command through wsl.exe -d <distro>", async () => {
      bindWith({
        shellContext: { shellType: "Bash", backendOs: "windows", wslDistroName: "Ubuntu" },
      });

      await service.run({ executable: "git", args: ["status"], contextRevision: 3 }, identity);

      expect(commandRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          program: "wsl.exe",
          args: ["-d", "Ubuntu", "git", "status"],
        }),
      );
    });

    it("rejects a stale context revision without running anything", async () => {
      bindWith({});

      const runResult = await service.run(
        { executable: "git", args: ["status"], contextRevision: 2 },
        identity,
      );

      expect(runResult).toEqual({ status: "rejected", reason: "stale-context" });
      expect(commandRunner.run).not.toHaveBeenCalled();
    });

    it("rejects an unknown (foreign) context with a reason", async () => {
      bindWith({ isContextKnown: false });

      const runResult = await service.run(
        { executable: "git", args: ["status"], contextRevision: 3 },
        identity,
      );

      expect(runResult).toEqual({ status: "rejected", reason: "unknown-context" });
      expect(commandRunner.run).not.toHaveBeenCalled();
    });

    it("rejects when the identity is no longer the bound session", async () => {
      bindWith({});
      appBus.publish({ path: ["app", "terminal"], type: "FocusTerminal", payload: "t2" });

      const runResult = await service.run(
        { executable: "git", args: ["status"], contextRevision: 3 },
        identity,
      );

      expect(runResult).toEqual({ status: "rejected", reason: "unbound" });
      expect(commandRunner.run).not.toHaveBeenCalled();
    });
  });
});
