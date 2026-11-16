import {
  Component,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  provideZonelessChangeDetection,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionEntry, SessionScopeBuilder } from "./session-scope.builder";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

@Component({ selector: "app-view-stand-in", standalone: true, template: "terminal" })
class ViewStandInComponent {}

describe("SessionScopeBuilder", () => {
  let builder: SessionScopeBuilder;
  let publish: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    publish = vi.fn();
    builder = new SessionScopeBuilder(
      TestBed.inject(EnvironmentInjector),
      { publish } as never,
      { unregister: vi.fn() } as never,
      {} as never,
    );
  });

  /** A session whose view is mounted at `mountPoint`. */
  function mountedAt(mountPoint: HTMLElement): SessionEntry {
    const view = createComponent(ViewStandInComponent, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
    });
    mountPoint.appendChild(view.location.nativeElement);
    const disposable = { dispose: vi.fn() };
    return {
      session: { close: vi.fn() },
      keybindings: disposable,
      notifications: disposable,
      clipboardPrompt: disposable,
      injector: { destroy: vi.fn() },
      view: view as unknown as ComponentRef<never>,
    } as unknown as SessionEntry;
  }

  it("takes the view off the pane, so a session that replaces it stands there alone", () => {
    const mountPoint = document.createElement("div");

    const entry = mountedAt(mountPoint);
    builder.close("t1", entry, false);

    expect(mountPoint.childElementCount).toBe(0);
    // Replaced, not removed: the app hears nothing of it, and the shell is
    // left to the session that replaces this one.
    expect(publish).not.toHaveBeenCalled();
    expect(entry.session.close).toHaveBeenCalledWith(false);
  });

  it("tells the app when the terminal goes for good", () => {
    const entry = mountedAt(document.createElement("div"));
    builder.close("t1", entry, true);

    expect(publish).toHaveBeenCalledWith({ type: "TerminalRemoved", payload: "t1" });
    expect(entry.session.close).toHaveBeenCalledWith(true);
  });
});
