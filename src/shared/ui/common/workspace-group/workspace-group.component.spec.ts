import { InputSignal, provideZonelessChangeDetection } from "@angular/core";
import { SIGNAL } from "@angular/core/primitives/signals";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceGroupComponent } from "./workspace-group.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/** The specs run JIT without the compiler, so a signal input is fed through its node. */
function setInput<T>(input: InputSignal<T>, value: T): void {
  const node = input[SIGNAL];
  node.applyValueToInputSignal(node, value);
}

/** Stands in for the browser's observer, which jsdom does not have. */
class IntersectionObserverStub {
  static instances: IntersectionObserverStub[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {
    IntersectionObserverStub.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  /** The observed mark crossed the edge of what the panel shows. */
  crossed(isIntersecting: boolean): void {
    if (!this.disconnected) this.callback([{ isIntersecting }]);
  }
}

/**
 * Pins when the workspace name takes its surface: only while it sticks, that
 * is while its group has moved up and the name is held at the top above the
 * tiles passing beneath it. At rest it has none.
 */
describe("WorkspaceGroupComponent", () => {
  let fixture: ComponentFixture<WorkspaceGroupComponent>;
  let group: HTMLElement;
  let header: HTMLElement;
  let restMark: HTMLElement;
  let observer: IntersectionObserverStub;

  /** The panel shows what lies between its top at 0 and this. */
  const PANEL_HEIGHT = 600;

  /** Places the resting place and the name, and reports the mark crossing the edge. */
  function moveTo(restTop: number, headerTop: number): void {
    restMark.getBoundingClientRect = () => new DOMRect(0, restTop, 300, 1);
    header.getBoundingClientRect = () => new DOMRect(0, headerTop, 300, 20);
    observer.crossed(restTop + 1 > 0 && restTop < PANEL_HEIGHT);
    if (!fixture.componentRef.hostView.destroyed) fixture.detectChanges();
  }

  beforeEach(() => {
    IntersectionObserverStub.instances = [];
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
    TestBed.configureTestingModule({
      imports: [WorkspaceGroupComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(WorkspaceGroupComponent);
    setInput(fixture.componentInstance.name, "Remote Hosts");
    setInput(fixture.componentInstance.color, "blue");
    fixture.detectChanges();
    group = fixture.nativeElement as HTMLElement;
    header = group.querySelector(".header") as HTMLElement;
    restMark = group.querySelector(".rest-mark") as HTMLElement;
    [observer] = IntersectionObserverStub.instances;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it("watches the mark of the name's resting place", () => {
    expect(observer.observed).toEqual([restMark]);
  });

  it("has no surface while the name rests in its place", () => {
    moveTo(116, 116);

    expect(header.classList.contains("stuck")).toBe(false);
  });

  it("takes its surface once the group moves up and the name is held at the top", () => {
    moveTo(-34, 0);

    expect(header.classList.contains("stuck")).toBe(true);
  });

  it("drops its surface again when the group comes back down", () => {
    moveTo(-34, 0);
    moveTo(116, 116);

    expect(header.classList.contains("stuck")).toBe(false);
  });

  it("drops its surface as soon as the resting place is back in view", () => {
    moveTo(-34, 0);
    // Half a pixel of the mark is back: the name is still pushed by that much.
    moveTo(-0.5, 0);

    expect(header.classList.contains("stuck")).toBe(false);
  });

  it("has no surface while the group is out of view below, name and mark together", () => {
    moveTo(900, 900);

    expect(header.classList.contains("stuck")).toBe(false);
  });

  it("listens to no scrolling: a terminal scrolls a lot", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const other = TestBed.createComponent(WorkspaceGroupComponent);
    other.detectChanges();

    expect(addEventListener).not.toHaveBeenCalledWith(
      "scroll",
      expect.anything(),
      expect.anything(),
    );
    addEventListener.mockRestore();
  });

  it("stops watching once the group is gone", () => {
    const component = fixture.componentInstance;
    fixture.destroy();

    expect(observer.disconnected).toBe(true);
    moveTo(-34, 0);
    expect(component.stuck()).toBe(false);
  });

  it("sets no colour for a group without one, so the surface falls back", () => {
    setInput(fixture.componentInstance.color, "");
    fixture.detectChanges();

    expect(header.style.getPropertyValue("--workspace-color")).toBe("");
  });

  it("carries the workspace colour for its surface", () => {
    expect(header.style.getPropertyValue("--workspace-color")).toBe("var(--color-blue)");
  });
});
