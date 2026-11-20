import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnInit,
  Signal,
  signal,
} from "@angular/core";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { AppInfo } from "@cogno/platform/app-info";
import { Opener } from "@cogno/platform/opener";
import { Paths } from "@cogno/platform/path";
import { UpdaterState } from "@cogno/platform/updater";
import { Icon, IconComponent } from "@cogno/shared/ui";
import { UpdaterService } from "./updater.service";

/** What Cogno is, which version runs and whether a newer one waits. */
@Component({
  selector: "app-updater-side",
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="updater-panel">
      <div class="about">
        <svg
          class="about__logo"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="62 62 1323 296"
          role="img"
          aria-label="Cogno"
        >
          <path d="M283.5 125.3 A112 112 0 1 0 283.5 274.7" fill="none" stroke="currentColor" stroke-width="40" stroke-linecap="round"></path>
          <path d="M192 160 L232 200 L192 240" fill="none" stroke="currentColor" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"></path>
          <circle cx="312" cy="200" r="30" fill="var(--color-yellow)"></circle>
          <path transform="translate(406 280.0) scale(0.2925)" d="M338 4Q258 4 195.5 -32.5Q133 -69 97.5 -131.5Q62 -194 62 -273Q62 -354 97.0 -417.0Q132 -480 193.0 -515.5Q254 -551 333 -551Q392 -551 441.0 -528.5Q490 -506 529 -461Q543 -445 539.0 -428.0Q535 -411 517 -398Q503 -388 486.0 -391.5Q469 -395 455 -409Q406 -461 333 -461Q282 -461 243.0 -437.5Q204 -414 182.0 -372.0Q160 -330 160 -273Q160 -219 182.5 -177.0Q205 -135 245.0 -110.5Q285 -86 338 -86Q373 -86 399.5 -94.5Q426 -103 448 -121Q464 -134 481.0 -135.5Q498 -137 511 -126Q528 -112 530.0 -94.5Q532 -77 518 -63Q446 4 338 4ZM939 4Q858 4 796.0 -31.5Q734 -67 698.5 -129.5Q663 -192 663 -273Q663 -355 698.5 -417.5Q734 -480 796.0 -515.5Q858 -551 939 -551Q1019 -551 1081.0 -515.5Q1143 -480 1178.5 -417.5Q1214 -355 1214 -273Q1214 -192 1179.0 -129.5Q1144 -67 1082.0 -31.5Q1020 4 939 4ZM939 -86Q991 -86 1031.0 -110.0Q1071 -134 1093.5 -176.0Q1116 -218 1116 -273Q1116 -328 1093.5 -370.5Q1071 -413 1031.0 -437.0Q991 -461 939 -461Q887 -461 847.0 -437.0Q807 -413 784.0 -370.5Q761 -328 761 -273Q761 -218 784.0 -176.0Q807 -134 847.0 -110.0Q887 -86 939 -86ZM1594 4Q1519 4 1461.5 -31.5Q1404 -67 1371.0 -129.5Q1338 -192 1338 -273Q1338 -355 1373.5 -417.5Q1409 -480 1471.0 -515.5Q1533 -551 1614 -551Q1694 -551 1756.0 -515.5Q1818 -480 1853.5 -417.5Q1889 -355 1889 -273H1830Q1830 -192 1799.5 -129.5Q1769 -67 1716.0 -31.5Q1663 4 1594 4ZM1612 227Q1541 227 1479.0 199.0Q1417 171 1374 117Q1361 100 1364.5 82.0Q1368 64 1384 53Q1402 41 1421.5 45.0Q1441 49 1453 65Q1480 99 1521.0 118.0Q1562 137 1614 137Q1662 137 1702.5 114.0Q1743 91 1767.0 46.0Q1791 1 1791 -64V-206L1824 -294L1889 -273V-57Q1889 22 1854.0 86.5Q1819 151 1756.5 189.0Q1694 227 1612 227ZM1614 -86Q1666 -86 1706.0 -110.0Q1746 -134 1768.5 -176.0Q1791 -218 1791 -273Q1791 -328 1768.5 -370.5Q1746 -413 1706.0 -437.0Q1666 -461 1614 -461Q1562 -461 1522.0 -437.0Q1482 -413 1459.0 -370.5Q1436 -328 1436 -273Q1436 -218 1459.0 -176.0Q1482 -134 1522.0 -110.0Q1562 -86 1614 -86ZM2503 1Q2481 1 2466.5 -13.5Q2452 -28 2452 -50V-296Q2452 -353 2431.0 -389.0Q2410 -425 2374.5 -442.5Q2339 -460 2293 -460Q2251 -460 2217.0 -443.0Q2183 -426 2163.0 -397.5Q2143 -369 2143 -332H2080Q2080 -395 2110.5 -444.5Q2141 -494 2194.0 -523.0Q2247 -552 2313 -552Q2382 -552 2436.5 -522.5Q2491 -493 2522.5 -436.0Q2554 -379 2554 -296V-50Q2554 -28 2539.5 -13.5Q2525 1 2503 1ZM2092 1Q2070 1 2055.5 -13.5Q2041 -28 2041 -50V-496Q2041 -519 2055.5 -533.0Q2070 -547 2092 -547Q2115 -547 2129.0 -533.0Q2143 -519 2143 -496V-50Q2143 -28 2129.0 -13.5Q2115 1 2092 1ZM2971 4Q2890 4 2828.0 -31.5Q2766 -67 2730.5 -129.5Q2695 -192 2695 -273Q2695 -355 2730.5 -417.5Q2766 -480 2828.0 -515.5Q2890 -551 2971 -551Q3051 -551 3113.0 -515.5Q3175 -480 3210.5 -417.5Q3246 -355 3246 -273Q3246 -192 3211.0 -129.5Q3176 -67 3114.0 -31.5Q3052 4 2971 4ZM2971 -86Q3023 -86 3063.0 -110.0Q3103 -134 3125.5 -176.0Q3148 -218 3148 -273Q3148 -328 3125.5 -370.5Q3103 -413 3063.0 -437.0Q3023 -461 2971 -461Q2919 -461 2879.0 -437.0Q2839 -413 2816.0 -370.5Q2793 -328 2793 -273Q2793 -218 2816.0 -176.0Q2839 -134 2879.0 -110.0Q2919 -86 2971 -86Z" fill="currentColor" stroke="currentColor" stroke-width="20" stroke-linejoin="round"></path>
        </svg>
        <div class="about__text">
          <p class="about__tagline">The terminal for the AI era.</p>
          <span class="about__version">v{{ version() }}</span>
        </div>
      </div>

      <div class="status" [class]="'status--' + statusTone()">
        <app-icon class="status__icon" [name]="statusIcon()"></app-icon>
        <span class="status__text">{{ statusText() }}</span>
      </div>

      @if (hasUpdateCard()) {
        <div class="update-card">
          @if (state()?.notes; as notes) {
            <div class="update-card__title">What's new</div>
            <div class="update-card__notes">{{ notes }}</div>
          }
          @if (canInstall()) {
            <button type="button" class="button primary" (click)="install()">
              {{ state()?.phase === "ready" ? "Restart to update" : "Update now" }}
            </button>
            <div class="update-card__hint">
              Cogno restarts; processes running in your terminals end.
            </div>
          }
          @if (mustDownload()) {
            <button type="button" class="button primary" (click)="openDownloadPage()">
              Download
            </button>
          }
        </div>
      }

      <div class="links">
        <button type="button" class="link" [disabled]="busy()" (click)="checkNow()">
          Check for updates
        </button>
        <button type="button" class="link" (click)="openDocumentation()">Documentation</button>
        <button type="button" class="link" (click)="openLog()">Open log</button>
      </div>
    </div>
  `,
  styles: `
    :host {
      font-size: var(--panel-font-size);
      display: block;
      height: 100%;
    }

    .updater-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: 100%;
      overflow-y: auto;
      padding: 0.5rem 0;
      font-size: 0.9rem;
    }

    .about {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .about__logo {
      align-self: flex-start;
      color: var(--foreground-color);
      height: 2.25rem;
      width: auto;
    }

    .about__text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
    }

    .about__tagline {
      opacity: 0.65;
    }

    .about__version {
      font-family: monospace;
      font-size: 0.8rem;
      opacity: 0.5;
    }

    .status {
      align-items: flex-start;
      display: flex;
      gap: 0.5rem;
    }

    .status__icon {
      flex: none;
      height: 1.1rem;
      margin-top: 0.05rem;
      opacity: 0.6;
      width: 1.1rem;
    }

    .status--good .status__icon {
      color: var(--color-green);
      opacity: 1;
    }

    .status--update .status__icon {
      color: var(--highlight-color);
      opacity: 1;
    }

    .status--bad .status__icon {
      color: var(--color-red);
      opacity: 1;
    }

    .status__text {
      word-break: break-word;
    }

    .update-card {
      align-items: flex-start;
      border: 1px solid var(--highlight-color);
      border-radius: var(--button-border-radius, 6px);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
    }

    .update-card__title {
      font-weight: 600;
    }

    .update-card__notes {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .update-card__hint {
      opacity: 0.7;
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .link {
      background: none;
      border: none;
      color: var(--highlight-color);
      font: inherit;
      padding: 0;
      text-underline-offset: 2px;
    }

    .link:hover:not(:disabled) {
      text-decoration: underline;
    }

    .link:disabled {
      opacity: 0.5;
    }
  `,
})
export class UpdaterSideComponent implements OnInit {
  readonly version = signal("…");
  readonly state: Signal<UpdaterState | undefined>;
  readonly busy = computed(() => {
    const phase = this.state()?.phase;
    return phase === "checking" || phase === "downloading";
  });
  readonly canInstall = computed(() => {
    const state = this.state();
    return !!state?.installable && (state.phase === "available" || state.phase === "ready");
  });
  readonly mustDownload = computed(() => {
    const state = this.state();
    return state?.phase === "available" && !state.installable;
  });
  readonly hasUpdateCard = computed(
    () => !!this.state()?.notes || this.canInstall() || this.mustDownload(),
  );
  readonly statusText = computed(() => statusText(this.state()));
  readonly statusTone = computed(() => statusTone(this.state()));
  readonly statusIcon = computed(() => STATUS_ICONS[this.statusTone()]);

  constructor(
    private readonly updaterService: UpdaterService,
    private readonly appInfo: AppInfo,
    private readonly opener: Opener,
    private readonly paths: Paths,
    private readonly bus: AppBus,
  ) {
    this.state = this.updaterService.state;
  }

  async ngOnInit(): Promise<void> {
    this.version.set(await this.appInfo.version());
  }

  checkNow(): void {
    void this.updaterService.checkNow();
  }

  install(): void {
    void this.updaterService.install();
  }

  openDownloadPage(): void {
    void this.updaterService.openDownloadPage();
  }

  openDocumentation(): void {
    this.bus.publish(ActionFired.create("open_documentation"));
  }

  async openLog(): Promise<void> {
    await this.opener.openPath(await this.paths.cognoLogFilePath());
  }
}

type StatusTone = "neutral" | "good" | "update" | "bad";

const STATUS_ICONS: Record<StatusTone, Icon> = {
  neutral: "mdiInformation",
  good: "mdiCheckCircle",
  update: "mdiDownload",
  bad: "mdiAlert",
};

function statusTone(state: UpdaterState | undefined): StatusTone {
  switch (state?.phase) {
    case "upToDate":
      return "good";
    case "available":
    case "downloading":
    case "ready":
      return "update";
    case "failed":
      return "bad";
    default:
      return "neutral";
  }
}

function statusText(state: UpdaterState | undefined): string {
  switch (state?.phase) {
    case undefined:
    case "idle":
      return "Not checked yet.";
    case "checking":
      return "Checking for updates...";
    case "upToDate":
      return "You are on the latest version.";
    case "available":
      return state.installable
        ? `Version ${state.version} is available.`
        : `Version ${state.version} is available. This installation cannot update itself; download the new version instead.`;
    case "downloading":
      return `Downloading version ${state.version}...`;
    case "ready":
      return `Version ${state.version} is ready to install.`;
    case "failed":
      return `The update failed: ${state.error ?? "unknown error"}`;
  }
}
