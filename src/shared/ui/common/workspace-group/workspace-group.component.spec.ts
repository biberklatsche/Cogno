import { InputSignal, provideZonelessChangeDetection } from "@angular/core";
import { SIGNAL } from "@angular/core/primitives/signals";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceGroupComponent } from "./workspace-group.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/** The specs run JIT without the compiler, so a signal input is fed through its node. */
function setInput<T>(input: InputSignal<T>, value: T): void {
  const node = input[SIGNAL];
  node.applyValueToInputSignal(node, value);
}

/**
 * Pins when the workspace name takes its surface: only while it sticks, that
 * is while its group has scrolled up and the name is held at the top above
 * the tiles passing beneath it. At rest it has none.
 */
describe("WorkspaceGroupComponent", () => {
  const PADDING = 16;
  let fixture: ComponentFixture<WorkspaceGroupComponent>;
  let group: HTMLElement;
  let header: HTMLElement;

  /** Places group and name as the scroll container would after a scroll. */
  async function scrollTo(groupTop: number, headerTop: number): Promise<void> {
    group.getBoundingClientRect = () => new DOMRect(0, groupTop, 300, 200);
    header.getBoundingClientRect = () => new DOMRect(0, headerTop, 300, 20);
    document.body.dispatchEvent(new Event("scroll"));
    if (!fixture.componentRef.hostView.destroyed) fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [WorkspaceGroupComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(WorkspaceGroupComponent);
    setInput(fixture.componentInstance.name, "Remote Hosts");
    setInput(fixture.componentInstance.color, "blue");
    fixture.detectChanges();
    group = fixture.nativeElement as HTMLElement;
    group.style.paddingTop = `${PADDING}px`;
    header = group.querySelector(".header") as HTMLElement;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("has no surface while the name rests right below the group's padding", async () => {
    await scrollTo(100, 100 + PADDING);

    expect(header.classList.contains("stuck")).toBe(false);
  });

  it("takes its surface once the group scrolls up and the name is held at the top", async () => {
    await scrollTo(-50, 0);

    expect(header.classList.contains("stuck")).toBe(true);
  });

  it("drops its surface again when the group scrolls back down", async () => {
    await scrollTo(-50, 0);
    await scrollTo(100, 100 + PADDING);

    expect(header.classList.contains("stuck")).toBe(false);
  });

  it("ignores scrolling elsewhere, such as a terminal", async () => {
    const terminal = document.createElement("div");
    document.body.appendChild(terminal);
    group.getBoundingClientRect = () => new DOMRect(0, -50, 300, 200);
    header.getBoundingClientRect = () => new DOMRect(0, 0, 300, 20);

    terminal.dispatchEvent(new Event("scroll"));
    fixture.detectChanges();

    expect(header.classList.contains("stuck")).toBe(false);
    terminal.remove();
  });

  it("stops listening once the group is gone", async () => {
    const component = fixture.componentInstance;
    fixture.destroy();
    // Back in the document, so a listener left behind would still see the group scroll.
    document.body.appendChild(group);

    await scrollTo(-50, 0);

    expect(component.stuck()).toBe(false);
    group.remove();
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
