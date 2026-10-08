import type { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import type { Opener } from "@cogno/platform/opener";
import type { OsPlatform } from "@cogno/platform/os";
import type { Updater, UpdaterState } from "@cogno/platform/updater";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHECK_INTERVAL_MS, UpdaterService } from "./updater.service";

vi.mock("@cogno/platform/logger", () => ({ Logger: { error: vi.fn() } }));

function state(overrides: Partial<UpdaterState>): UpdaterState {
  return {
    phase: "idle",
    currentVersion: "0.5.0",
    version: null,
    notes: null,
    installable: true,
    error: null,
    ...overrides,
  };
}

describe("UpdaterService", () => {
  let state$: Subject<UpdaterState>;
  let updater: { state$: Subject<UpdaterState>; check: ReturnType<typeof vi.fn> };
  let dispatch: ReturnType<typeof vi.fn>;
  let openUrl: ReturnType<typeof vi.fn>;
  let installMode: "background" | "ask" | undefined;
  let service: UpdaterService;

  beforeEach(() => {
    vi.useFakeTimers();
    state$ = new Subject<UpdaterState>();
    updater = { state$, check: vi.fn().mockResolvedValue(undefined) };
    dispatch = vi.fn();
    openUrl = vi.fn().mockResolvedValue(undefined);
    installMode = undefined;
    service = new UpdaterService(
      updater as unknown as Updater,
      {
        getConfiguration: () => ({ feature: { updater: { install: installMode } } }),
      } as unknown as ApplicationConfigurationPort,
      { dispatch } as unknown as NotificationCenterPort,
      { openUrl } as unknown as Opener,
      { platform: () => "linux" } as unknown as OsPlatform,
    );
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it("checks on start and then on its interval, downloading in the background by default", () => {
    service.start();
    expect(updater.check).toHaveBeenLastCalledWith({ force: false, download: true });

    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    expect(updater.check).toHaveBeenCalledTimes(2);
  });

  it("does not download on its own when set to ask", () => {
    installMode = "ask";
    service.start();
    expect(updater.check).toHaveBeenLastCalledWith({ force: false, download: false });
  });

  it("forces the check the user asks for", async () => {
    await service.checkNow();
    expect(updater.check).toHaveBeenLastCalledWith({ force: true, download: true });
  });

  it("stops checking and following the state once stopped", () => {
    service.start();
    service.stop();

    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    state$.next(state({ phase: "ready", version: "0.6.0" }));
    expect(updater.check).toHaveBeenCalledOnce();
    expect(service.state()).toBeUndefined();
  });

  it("announces a downloaded version once, not while it is still only available", () => {
    service.start();
    state$.next(state({ phase: "available", version: "0.6.0" }));
    state$.next(state({ phase: "downloading", version: "0.6.0" }));
    expect(dispatch).not.toHaveBeenCalled();

    state$.next(state({ phase: "ready", version: "0.6.0" }));
    state$.next(state({ phase: "ready", version: "0.6.0" }));
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0].header).toBe("Cogno 0.6.0 is ready");
  });

  it("announces an available version at once when the user installs it", () => {
    installMode = "ask";
    service.start();
    state$.next(state({ phase: "available", version: "0.6.0" }));
    expect(dispatch.mock.calls[0][0].header).toBe("Cogno 0.6.0 is available");
  });

  it("announces an available version at once when this installation cannot update itself", () => {
    service.start();
    state$.next(state({ phase: "available", version: "0.6.0", installable: false }));
    expect(dispatch.mock.calls[0][0].body).toContain("download");
  });

  it("opens the download page for this platform", async () => {
    await service.openDownloadPage();
    expect(openUrl).toHaveBeenCalledWith("https://dl.cogno.rocks/download/linux");
  });
});
