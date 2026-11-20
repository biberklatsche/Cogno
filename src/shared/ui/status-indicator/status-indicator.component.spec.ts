import { InputSignal, provideZonelessChangeDetection } from "@angular/core";
import { SIGNAL } from "@angular/core/primitives/signals";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusIndicator, StatusIndicatorComponent } from "./status-indicator.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/** The specs run JIT without the compiler, so a signal input is fed through its node. */
function setInput<T>(input: InputSignal<T>, value: T): void {
  const node = input[SIGNAL];
  node.applyValueToInputSignal(node, value);
}

/**
 * Pins how the indicator switches: a new mood restarts the animation in place,
 * a new motif cross-fades, and no indicator fades out and leaves nothing behind.
 */
describe("StatusIndicatorComponent", () => {
  let fixture: ComponentFixture<StatusIndicatorComponent>;

  const layers = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<SVGElement>("svg.layer"));
  const classesOf = (layer: SVGElement) => (layer.getAttribute("class") ?? "").split(" ");

  /** Two passes: the first runs the effect that picks the layers, the second renders them. */
  function render(): void {
    fixture.detectChanges();
    fixture.detectChanges();
  }

  function show(indicator: StatusIndicator | undefined): void {
    setInput(fixture.componentInstance.indicator, indicator);
    render();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [StatusIndicatorComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(StatusIndicatorComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it("is empty without an indicator", () => {
    show(undefined);

    expect(layers()).toEqual([]);
  });

  it("draws the motif with its mood", () => {
    show({ motif: "face", mood: "asking" });

    expect(layers()).toHaveLength(1);
    expect(classesOf(layers()[0])).toEqual(expect.arrayContaining(["face", "asking"]));
  });

  it("switches the mood of the same motif in place", () => {
    show({ motif: "face", mood: "busy" });
    const before = layers()[0];

    show({ motif: "face", mood: "failed" });

    expect(layers()).toEqual([before]);
    expect(classesOf(before)).toEqual(expect.arrayContaining(["face", "failed"]));
    expect(classesOf(before)).not.toContain("busy");
  });

  it("cross-fades to another motif and then drops the old one", () => {
    show({ motif: "equalizer", mood: "busy" });

    show({ motif: "face", mood: "busy" });

    expect(layers().map(classesOf)).toEqual([
      expect.arrayContaining(["equalizer", "leaving"]),
      expect.arrayContaining(["face", "busy"]),
    ]);

    vi.advanceTimersByTime(150);
    render();

    expect(layers()).toHaveLength(1);
    expect(classesOf(layers()[0])).toContain("face");
  });

  it("fades out when the indicator goes away", () => {
    show({ motif: "equalizer", mood: "calm" });

    show(undefined);
    expect(classesOf(layers()[0])).toContain("leaving");

    vi.advanceTimersByTime(150);
    render();
    expect(layers()).toEqual([]);
  });

  it("gives a face fading in its own mask while the previous face still fades out", () => {
    show({ motif: "face", mood: "calm" });
    show(undefined);

    show({ motif: "face", mood: "busy" });

    const maskIds = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll("mask"),
      (mask) => mask.id,
    );
    expect(maskIds).toHaveLength(2);
    expect(new Set(maskIds).size).toBe(2);
  });
});
