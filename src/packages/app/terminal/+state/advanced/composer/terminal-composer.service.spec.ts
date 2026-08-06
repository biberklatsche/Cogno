import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../../../../app-bus/app-bus";
import type { TerminalState } from "../../state";
import { TerminalDropdownCoordinatorService } from "../ui/terminal-dropdown-coordinator.service";
import { TerminalComposerService } from "./terminal-composer.service";

class FakeStateManager {
  private readonly subject = new BehaviorSubject<Partial<TerminalState>>({
    terminalId: "t1",
    cursorPosition: { viewport: { col: 5, row: 3 }, col: 5, row: 3, char: "" },
    dimensions: {
      rows: 24,
      cols: 80,
      cellHeight: 18,
      cellWidth: 9,
      viewportWidth: 720,
      viewportHeight: 432,
    },
    isCommandRunning: false,
    input: { text: "", cursorIndex: 0, maxCursorIndex: 0 },
  });

  get state() {
    return this.subject.value;
  }
  get terminalId() {
    return this.subject.value.terminalId;
  }
  get isCommandRunning() {
    return this.subject.value.isCommandRunning;
  }

  emit(next: Partial<TerminalState>) {
    this.subject.next({ ...this.subject.value, ...next });
  }
}

describe("TerminalComposerService", () => {
  let fakeState: FakeStateManager;
  let bus: AppBus;
  let coordinator: TerminalDropdownCoordinatorService;
  let service: TerminalComposerService;

  function openViaBus(seedText = "echo a\necho b", cursorIndex = 7, terminalId = "t1") {
    bus.publish({
      path: ["app", "terminal"],
      type: "OpenComposer",
      payload: { terminalId, seedText, cursorIndex },
    });
  }

  beforeEach(() => {
    fakeState = new FakeStateManager();
    bus = new AppBus();
    coordinator = new TerminalDropdownCoordinatorService();
    service = new TerminalComposerService(fakeState as unknown as any, bus, coordinator);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  function currentView() {
    let view: any;
    service.viewState$.subscribe((v) => (view = v)).unsubscribe();
    return view;
  }

  it("opens with the seed when the OpenComposer event targets this terminal", () => {
    openViaBus("echo a\necho b", 7);

    expect(currentView()).toMatchObject({
      visible: true,
      seedText: "echo a\necho b",
      seedCursorIndex: 7,
    });
  });

  it("normalizes CRLF in the seed and clamps the cursor index", () => {
    openViaBus("echo a\r\necho b", 999);

    const view = currentView();
    expect(view.seedText).toBe("echo a\necho b");
    expect(view.seedCursorIndex).toBeLessThanOrEqual(view.seedText.length + 1);
  });

  it("ignores OpenComposer events for other terminals", () => {
    openViaBus("echo a\necho b", 0, "other-terminal");

    expect(currentView().visible).toBe(false);
  });

  it("ignores OpenComposer while a command is running", () => {
    fakeState.emit({ isCommandRunning: true });

    openViaBus();

    expect(currentView().visible).toBe(false);
  });

  it("closes other dropdowns by claiming the coordinator", () => {
    const claimSpy = vi.spyOn(coordinator, "claim");

    openViaBus();

    expect(claimSpy).toHaveBeenCalledWith(service);
  });

  it("submits the composed text as one atomic replace with autoExecute", () => {
    const publishSpy = vi.spyOn(bus, "publish");
    openViaBus();

    service.submit("echo one\necho two");

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ReplaceTerminalInput",
        payload: {
          terminalId: "t1",
          inputText: "echo one\necho two",
          cursorIndex: "echo one\necho two".length,
          autoExecute: true,
        },
      }),
    );
    expect(currentView().visible).toBe(false);
  });

  it("trims trailing blank lines before submitting", () => {
    const publishSpy = vi.spyOn(bus, "publish");
    openViaBus();

    service.submit("echo one\necho two\n\n");

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ReplaceTerminalInput",
        payload: expect.objectContaining({
          inputText: "echo one\necho two",
          cursorIndex: "echo one\necho two".length,
        }),
      }),
    );
  });

  it("submits without executing when insertOnly is requested", () => {
    const publishSpy = vi.spyOn(bus, "publish");
    openViaBus();

    service.submit("echo draft", { insertOnly: true });

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ReplaceTerminalInput",
        payload: expect.objectContaining({ autoExecute: false }),
      }),
    );
  });

  it("closes on Escape dispatched from outside the panel", () => {
    openViaBus();

    const event = new KeyboardEvent("keydown", { key: "Escape" });
    service.dispatchKeydown(event);

    expect(currentView().visible).toBe(false);
  });

  it("releases the coordinator when hidden", () => {
    const releaseSpy = vi.spyOn(coordinator, "release");
    openViaBus();

    service.hide();

    expect(releaseSpy).toHaveBeenCalledWith(service);
  });
});
