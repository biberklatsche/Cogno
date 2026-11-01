import type { DestroyRef } from "@angular/core";
import {
  type ActionDefinition,
  KeybindActionInterpreter,
} from "@cogno/core/infrastructure/keybindings/keybind-action.interpreter";
import type { ActionRunner } from "@cogno/core/workbench/actions/action-runner";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { CliActionListener } from "@cogno/platform/cli-action";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CliActionService } from "./cli-action.service";

type DestroyRefPort = Pick<DestroyRef, "onDestroy">;

describe("CliActionService", () => {
  let _service: CliActionService;
  let actionRunnerMock: Pick<ActionRunner, "run">;
  let destroyRefMock: DestroyRefPort;
  let registerSpy: ReturnType<typeof vi.fn>;
  let registerNoticeSpy: ReturnType<typeof vi.fn>;
  let unlistenMock: ReturnType<typeof vi.fn>;
  let cliActionsStub: CliActionListener;
  let appBusStub: Pick<AppBus, "publish">;

  beforeEach(() => {
    unlistenMock = vi.fn();
    registerSpy = vi.fn().mockResolvedValue(unlistenMock as unknown as () => void);
    registerNoticeSpy = vi.fn().mockResolvedValue(unlistenMock as unknown as () => void);
    cliActionsStub = {
      register: registerSpy,
      registerNotice: registerNoticeSpy,
    } as unknown as CliActionListener;
    appBusStub = { publish: vi.fn() };

    actionRunnerMock = {
      run: vi.fn().mockReturnValue("dispatched"),
    };

    destroyRefMock = {
      onDestroy: vi.fn(),
    };
  });

  it("should register a listener on initialization", () => {
    _service = new CliActionService(
      cliActionsStub,
      actionRunnerMock as ActionRunner,
      appBusStub as AppBus,
      destroyRefMock as unknown as DestroyRef,
    );
    expect(registerSpy).toHaveBeenCalled();
  });

  it("shows what a second start could not pass on as a warning", () => {
    _service = new CliActionService(
      cliActionsStub,
      actionRunnerMock as ActionRunner,
      appBusStub as AppBus,
      destroyRefMock as unknown as DestroyRef,
    );
    const onNotice = registerNoticeSpy.mock.calls[0][0];

    onNotice("Cogno is already running: --set was ignored.");

    expect(appBusStub.publish).toHaveBeenCalledWith({
      type: "Notification",
      payload: {
        header: "Command line",
        body: "Cogno is already running: --set was ignored.",
        type: "warning",
      },
    });
  });

  it("should parse and dispatch action when listener is triggered", async () => {
    _service = new CliActionService(
      cliActionsStub,
      actionRunnerMock as ActionRunner,
      appBusStub as AppBus,
      destroyRefMock as unknown as DestroyRef,
    );

    const callback = registerSpy.mock.calls[0][0];

    const testAction = "test-action";
    const mockActionDef: ActionDefinition = {
      actionName: "test-action",
      trigger: undefined,
      args: [],
    };
    const parseSpy = vi.spyOn(KeybindActionInterpreter, "parse").mockReturnValue(mockActionDef);

    callback(testAction);

    expect(parseSpy).toHaveBeenCalledWith(testAction);
    expect(actionRunnerMock.run).toHaveBeenCalledWith("test-action", []);
  });

  it("should call unlisten when DestroyRef.onDestroy is triggered", async () => {
    _service = new CliActionService(
      cliActionsStub,
      actionRunnerMock as ActionRunner,
      appBusStub as AppBus,
      destroyRefMock as unknown as DestroyRef,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(destroyRefMock.onDestroy).toHaveBeenCalled();

    const cleanup = (destroyRefMock.onDestroy as ReturnType<typeof vi.fn>).mock.calls[0][0];
    cleanup();

    expect(unlistenMock).toHaveBeenCalled();
  });
});
