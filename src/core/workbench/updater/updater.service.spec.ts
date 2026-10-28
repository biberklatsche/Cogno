import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
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
  let announcement$: Subject<UpdaterState>;
  let updater: {
    state$: Subject<UpdaterState>;
    announcement$: Subject<UpdaterState>;
    check: ReturnType<typeof vi.fn>;
  };
  let dispatch: ReturnType<typeof vi.fn>;
  let openUrl: ReturnType<typeof vi.fn>;
  let configuration: { updater?: { install?: "background" | "ask" } } | undefined;
  let service: UpdaterService;

  beforeEach(() => {
    vi.useFakeTimers();
    state$ = new Subject<UpdaterState>();
    announcement$ = new Subject<UpdaterState>();
    updater = { state$, announcement$, check: vi.fn().mockResolvedValue(undefined) };
    dispatch = vi.fn();
    openUrl = vi.fn().mockResolvedValue(undefined);
    configuration = {};
    service = new UpdaterService(
      updater as unknown as Updater,
      {
        get config() {
          return configuration;
        },
      } as unknown as ConfigService,
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

  it("downloads in the background while the configuration is not loaded yet", () => {
    configuration = undefined;
    service.start();
    expect(updater.check).toHaveBeenLastCalledWith({ force: false, download: true });
  });

  it("does not download on its own when set to ask", () => {
    configuration = { updater: { install: "ask" } };
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
    announcement$.next(state({ phase: "ready", version: "0.6.0" }));
    expect(updater.check).toHaveBeenCalledOnce();
    expect(service.state()).toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("shows the state without announcing it; announcing is Rust's call", () => {
    service.start();
    state$.next(state({ phase: "ready", version: "0.6.0" }));
    expect(service.state()?.phase).toBe("ready");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("notifies about a version Rust announces as ready", () => {
    service.start();
    announcement$.next(state({ phase: "ready", version: "0.6.0" }));
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0].header).toBe("Cogno 0.6.0 is ready");
    expect(dispatch.mock.calls[0][0].body).toContain("install");
  });

  it("points to the download when the announced version cannot be installed here", () => {
    service.start();
    announcement$.next(state({ phase: "available", version: "0.6.0", installable: false }));
    expect(dispatch.mock.calls[0][0].header).toBe("Cogno 0.6.0 is available");
    expect(dispatch.mock.calls[0][0].body).toContain("download");
  });

  it("opens the download page for this platform", async () => {
    await service.openDownloadPage();
    expect(openUrl).toHaveBeenCalledWith("https://dl.cogno.rocks/download/linux");
  });
});
