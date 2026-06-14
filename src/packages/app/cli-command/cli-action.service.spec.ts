import type { DestroyRef } from "@angular/core";
import { CliActionListener } from "@cogno/app-tauri/cli-action";
import type { ActionDispatcher } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ActionDefinition,
  KeybindActionInterpreter,
} from "../keybinding/keybind-action.interpreter";
import { CliActionService } from "./cli-action.service";

type DispatcherPort = Pick<ActionDispatcher, "dispatchAction">;
type DestroyRefPort = Pick<DestroyRef, "onDestroy">;

describe("CliActionService", () => {
  let _service: CliActionService;
  let dispatcherMock: DispatcherPort;
  let destroyRefMock: DestroyRefPort;
  let registerSpy: ReturnType<typeof vi.spyOn>;
  let unlistenMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unlistenMock = vi.fn();
    registerSpy = vi
      .spyOn(CliActionListener, "register")
      .mockResolvedValue(unlistenMock as unknown as () => void);

    dispatcherMock = {
      dispatchAction: vi.fn(),
    };

    destroyRefMock = {
      onDestroy: vi.fn(),
    };
  });

  it("should register a listener on initialization", () => {
    _service = new CliActionService(
      dispatcherMock as ActionDispatcher,
      destroyRefMock as unknown as DestroyRef,
    );
    expect(registerSpy).toHaveBeenCalled();
  });

  it("should parse and dispatch action when listener is triggered", async () => {
    _service = new CliActionService(
      dispatcherMock as ActionDispatcher,
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
    expect(dispatcherMock.dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: "test-action",
        args: [],
      }),
    );
  });

  it("should call unlisten when DestroyRef.onDestroy is triggered", async () => {
    _service = new CliActionService(
      dispatcherMock as ActionDispatcher,
      destroyRefMock as unknown as DestroyRef,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(destroyRefMock.onDestroy).toHaveBeenCalled();

    const cleanup = (destroyRefMock.onDestroy as ReturnType<typeof vi.fn>).mock.calls[0][0];
    cleanup();

    expect(unlistenMock).toHaveBeenCalled();
  });
});
