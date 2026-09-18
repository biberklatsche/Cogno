import { TerminalDropdownCoordinatorService } from "@cogno/core/session/dropdown/terminal-dropdown-coordinator.service";
import type { SessionState } from "@cogno/core/session/host/session-host";
import type { SessionFact } from "@cogno/core/session/session-facts";
import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalComposerService } from "./terminal-composer.service";

class FakeStateManager {
  readonly facts = new Subject<SessionFact>();
  readonly facts$ = this.facts.asObservable();
  readonly replaceInput = vi.fn();
  private readonly subject = new BehaviorSubject<Partial<SessionState>>({
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

  emit(next: Partial<SessionState>) {
    this.subject.next({ ...this.subject.value, ...next });
  }
}

describe("TerminalComposerService", () => {
  let fakeState: FakeStateManager;
  let coordinator: TerminalDropdownCoordinatorService;
  let service: TerminalComposerService;

  function requestComposer(seedText = "echo a\necho b", cursorIndex = 7) {
    fakeState.facts.next({ type: "composerRequested", seedText, cursorIndex });
  }

  beforeEach(() => {
    fakeState = new FakeStateManager();
    coordinator = new TerminalDropdownCoordinatorService();
    service = new TerminalComposerService(fakeState as unknown as any, coordinator);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  function currentView() {
    let view: any;
    service.viewState$.subscribe((v) => (view = v)).unsubscribe();
    return view;
  }

  it("opens with the seed when the session asks for the composer", () => {
    requestComposer("echo a\necho b", 7);

    expect(currentView()).toMatchObject({
      visible: true,
      seedText: "echo a\necho b",
      seedCursorIndex: 7,
    });
  });

  it("normalizes CRLF in the seed and clamps the cursor index", () => {
    requestComposer("echo a\r\necho b", 999);

    const view = currentView();
    expect(view.seedText).toBe("echo a\necho b");
    expect(view.seedCursorIndex).toBeLessThanOrEqual(view.seedText.length + 1);
  });

  it("ignores the request while a command is running", () => {
    fakeState.emit({ isCommandRunning: true });

    requestComposer();

    expect(currentView().visible).toBe(false);
  });

  it("closes other dropdowns by claiming the coordinator", () => {
    const claimSpy = vi.spyOn(coordinator, "claim");

    requestComposer();

    expect(claimSpy).toHaveBeenCalledWith(service);
  });

  it("submits the composed text as one atomic replace with autoExecute", () => {
    requestComposer();

    service.submit("echo one\necho two");

    expect(fakeState.replaceInput).toHaveBeenCalledWith(
      "echo one\necho two",
      "echo one\necho two".length,
      true,
    );
    expect(currentView().visible).toBe(false);
  });

  it("trims trailing blank lines before submitting", () => {
    requestComposer();

    service.submit("echo one\necho two\n\n");

    expect(fakeState.replaceInput).toHaveBeenCalledWith(
      "echo one\necho two",
      "echo one\necho two".length,
      true,
    );
  });

  it("submits without executing when insertOnly is requested", () => {
    requestComposer();

    service.submit("echo draft", { insertOnly: true });

    expect(fakeState.replaceInput).toHaveBeenCalledWith("echo draft", "echo draft".length, false);
  });

  it("closes on Escape dispatched from outside the panel", () => {
    requestComposer();

    const event = new KeyboardEvent("keydown", { key: "Escape" });
    service.dispatchKeydown(event);

    expect(currentView().visible).toBe(false);
  });

  it("releases the coordinator when hidden", () => {
    const releaseSpy = vi.spyOn(coordinator, "release");
    requestComposer();

    service.hide();

    expect(releaseSpy).toHaveBeenCalledWith(service);
  });
});
