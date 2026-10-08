import { Injectable, Signal, signal } from "@angular/core";
import { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { Logger } from "@cogno/platform/logger";
import { Opener } from "@cogno/platform/opener";
import { OsPlatform } from "@cogno/platform/os";
import { Updater, UpdaterState } from "@cogno/platform/updater";
import { Subscription } from "rxjs";

/** How often a running window asks for a check; Rust skips the ones that come too close together. */
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const DOWNLOAD_BASE_URL = "https://dl.cogno.rocks/download";

type InstallMode = "background" | "ask";

/**
 * Follows the app's update state and asks for checks while the feature is on.
 * The state itself is Rust's (one per app); this window only shows it, and
 * announces each new version once.
 */
@Injectable({ providedIn: "root" })
export class UpdaterService {
  private readonly stateSignal = signal<UpdaterState | undefined>(undefined);
  readonly state: Signal<UpdaterState | undefined> = this.stateSignal.asReadonly();

  private subscription?: Subscription;
  private timer?: ReturnType<typeof setInterval>;
  private announcedVersion?: string;

  constructor(
    private readonly updater: Updater,
    private readonly configPort: ApplicationConfigurationPort,
    private readonly notificationCenter: NotificationCenterPort,
    private readonly opener: Opener,
    private readonly os: OsPlatform,
  ) {}

  start(): void {
    if (this.subscription) return;
    this.subscription = this.updater.state$.subscribe((state) => {
      this.stateSignal.set(state);
      this.announce(state);
    });
    void this.check(false);
    this.timer = setInterval(() => void this.check(false), CHECK_INTERVAL_MS);
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  checkNow(): Promise<void> {
    return this.check(true);
  }

  /** Installs and restarts; a failure arrives as the `failed` state. */
  async install(): Promise<void> {
    try {
      await this.updater.install();
    } catch (error) {
      Logger.error(`[Updater] Install failed: ${String(error)}`);
    }
  }

  openDownloadPage(): Promise<void> {
    return this.opener.openUrl(`${DOWNLOAD_BASE_URL}/${this.os.platform()}`);
  }

  private async check(force: boolean): Promise<void> {
    try {
      await this.updater.check({ force, download: this.installMode() === "background" });
    } catch (error) {
      Logger.error(`[Updater] Check failed: ${String(error)}`);
    }
  }

  private installMode(): InstallMode {
    const config = this.configPort.getConfiguration() as {
      feature?: { updater?: { install?: InstallMode } };
    };
    return config.feature?.updater?.install ?? "background";
  }

  /**
   * One notification per version: when it is ready to install, or - when it
   * will not be downloaded on its own - as soon as it is available.
   */
  private announce(state: UpdaterState): void {
    if (!state.version || state.version === this.announcedVersion) return;
    const waitsForUser =
      state.phase === "available" && (!state.installable || this.installMode() === "ask");
    if (state.phase !== "ready" && !waitsForUser) return;

    this.announcedVersion = state.version;
    this.notificationCenter.dispatch({
      header: `Cogno ${state.version} is ${state.phase === "ready" ? "ready" : "available"}`,
      body: state.installable
        ? "Open Updates in the side menu to install it."
        : "Open Updates in the side menu to download it.",
      type: "info",
      timestamp: new Date(),
    });
  }
}
