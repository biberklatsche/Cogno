import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToggleSwitchComponent } from "./toggle-switch.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe("ToggleSwitchComponent", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToggleSwitchComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("reflects the checked state on the host", async () => {
    const fixture = TestBed.createComponent(ToggleSwitchComponent);
    fixture.componentRef.setInput("checked", true);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute("role")).toBe("switch");
    expect(host.getAttribute("aria-checked")).toBe("true");
    expect(host.classList.contains("on")).toBe(true);
  });

  it("is off by default", async () => {
    const fixture = TestBed.createComponent(ToggleSwitchComponent);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute("aria-checked")).toBe("false");
    expect(host.classList.contains("on")).toBe(false);
  });
});
