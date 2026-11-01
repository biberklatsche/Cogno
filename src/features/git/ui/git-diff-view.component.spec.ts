import { ElementRef, InputSignal, provideZonelessChangeDetection } from "@angular/core";
import { SIGNAL } from "@angular/core/primitives/signals";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitDiffViewComponent } from "./git-diff-view.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/** The specs run JIT without the compiler, so a signal input is fed through its node. */
function setInput<T>(input: InputSignal<T>, value: T): void {
  const node = input[SIGNAL];
  node.applyValueToInputSignal(node, value);
}

/** Flush the effect, then the frame the editor waits for before it is built. */
async function settled(): Promise<void> {
  TestBed.tick();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await Promise.resolve();
}

describe("GitDiffViewComponent", () => {
  let component: GitDiffViewComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    // The component's own template, as rendered, without the compiler.
    element = document.createElement("app-git-diff-view");
    element.innerHTML = '<div class="diff-host"></div><div class="change-ruler"></div>';
    component = TestBed.runInInjectionContext(
      () => new GitDiffViewComponent(new ElementRef(element)),
    );
    setInput(component.diff, { original: "a\nb\n", modified: "a\nc\n", language: undefined });
    await settled();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("builds a split editor with a change mark once the inputs are set", () => {
    expect(element.querySelector(".cm-mergeView")).not.toBeNull();
    expect(element.querySelectorAll(".diff-host .cm-editor")).toHaveLength(2);
    expect(element.querySelectorAll(".change-ruler .ruler-mark")).toHaveLength(1);
  });

  it("replaces the editor when the mode changes", async () => {
    setInput(component.mode, "unified");
    await settled();

    expect(element.querySelector(".cm-mergeView")).toBeNull();
    expect(element.querySelectorAll(".diff-host .cm-editor")).toHaveLength(1);
  });

  it("tears the editor down with the component", () => {
    TestBed.resetTestingModule();

    expect(element.querySelector(".cm-editor")).toBeNull();
    expect(element.querySelectorAll(".ruler-mark")).toHaveLength(0);
  });
});
