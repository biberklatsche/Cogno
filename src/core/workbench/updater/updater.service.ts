import { Injectable, Signal, signal } from "@angular/core";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
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
 * Follows the app's update state and asks for checks while the window is open.
 * The state itself is Rust's (one per app); this window only shows it, and
 * turns the announcement Rust sends it - once per app and version - into a
 * notification.
 */
@Injectable({ providedIn: "root" })
export class UpdaterService {
  private readonly stateSignal = signal<UpdaterState | undefined>(undefined);
  readonly state: Signal<UpdaterState | undefined> = this.stateSignal.asReadonly();

  private subscriptions?: Subscription;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly updater: Updater,
    private readonly config: ConfigService,
    private readonly notificationCenter: NotificationCenterPort,
    private readonly opener: Opener,
    private readonly os: OsPlatform,
  ) {}

  start(): void {
    if (this.subscriptions) return;
    this.subscriptions = new Subscription();
    this.subscriptions.add(this.updater.state$.subscribe((state) => this.stateSignal.set(state)));
    this.subscriptions.add(this.updater.announcement$.subscribe((state) => this.announce(state)));
    void this.check(false);
    this.timer = setInterval(() => void this.check(false), CHECK_INTERVAL_MS);
  }

  stop(): void {
    this.subscriptions?.unsubscribe();
    this.subscriptions = undefined;
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

  /** `background` until the config is loaded; a check may run before it is. */
  private installMode(): InstallMode {
    try {
      return this.config.config.updater?.install ?? "background";
    } catch {
      return "background";
    }
  }

  private announce(state: UpdaterState): void {
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
