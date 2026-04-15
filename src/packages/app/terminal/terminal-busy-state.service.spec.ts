import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../features/__test__/destroy-ref";
import { AppBus } from "../app-bus/app-bus";
import { DialogRef, type DialogService } from "../common/dialog";
import type { GridListService } from "../grid-list/+state/grid-list.service";
import { TerminalBusyStateService } from "./terminal-busy-state.service";

describe("TerminalBusyStateService", () => {
  let appBus: AppBus;
  let dialogService: DialogService;
  let gridListService: GridListService;
  let terminalBusyStateService: TerminalBusyStateService;

  beforeEach(() => {
    appBus = new AppBus();
    dialogService = {
      open: vi.fn(),
    } as unknown as DialogService;
    gridListService = {
      findWorkspaceIdentifierByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "terminal-1"
          ? "workspace-1"
          : terminalId === "terminal-2"
            ? "workspace-2"
            : undefined,
      ),
    } as unknown as GridListService;
    terminalBusyStateService = new TerminalBusyStateService(
      appBus,
      dialogService,
      gridListService,
      getDestroyRef(),
    );
  });

  it("tracks busy terminal ids through bus events", () => {
    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalBusyChanged",
      payload: {
        terminalId: "terminal-1",
        isBusy: true,
      },
    });

    expect(terminalBusyStateService.hasBusyTerminals()).toBe(true);
    expect(terminalBusyStateService.getBusyTerminalCount()).toBe(1);

    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalRemoved",
      payload: "terminal-1",
    });

    expect(terminalBusyStateService.hasBusyTerminals()).toBe(false);
    expect(terminalBusyStateService.getBusyTerminalCount()).toBe(0);
  });

  it("allows the action immediately when no terminal is busy", async () => {
    await expect(
      terminalBusyStateService.confirmProceedIfNoBusyTerminals("close this workspace"),
    ).resolves.toBe(true);
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("returns the dialog result when busy terminals exist", async () => {
    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalBusyChanged",
      payload: {
        terminalId: "terminal-1",
        isBusy: true,
      },
    });

    const dialogRef = new DialogRef<boolean>(1, vi.fn());
    vi.mocked(dialogService.open).mockImplementation(() => {
      queueMicrotask(() => dialogRef.close(true));
      return dialogRef;
    });

    await expect(
      terminalBusyStateService.confirmProceedIfNoBusyTerminals("quit the application"),
    ).resolves.toBe(true);
    expect(dialogService.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          actionLabel: "quit the application",
          busyTerminalCount: 1,
        }),
      }),
    );
  });

  it("returns false when the user cancels the dialog", async () => {
    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalBusyChanged",
      payload: {
        terminalId: "terminal-1",
        isBusy: true,
      },
    });

    const dialogRef = new DialogRef<boolean>(1, vi.fn());
    vi.mocked(dialogService.open).mockImplementation(() => {
      queueMicrotask(() => dialogRef.close(false));
      return dialogRef;
    });

    await expect(
      terminalBusyStateService.confirmProceedIfNoBusyTerminals("close the application window"),
    ).resolves.toBe(false);
  });

  it("checks busy terminals only inside the requested workspace", async () => {
    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalBusyChanged",
      payload: {
        terminalId: "terminal-1",
        isBusy: true,
      },
    });

    await expect(
      terminalBusyStateService.confirmProceedIfNoBusyTerminalsInWorkspace(
        "close this workspace",
        "workspace-2",
      ),
    ).resolves.toBe(true);

    expect(dialogService.open).not.toHaveBeenCalled();
  });
});
