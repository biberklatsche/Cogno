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
          viewBox="0 0 400 400"
          aria-hidden="true"
        >
          <circle cx="200" cy="200" r="198" fill="var(--foreground-color)"></circle>
          <path
            d="M300 95 C 292 98,287 110,285 131 C 283 145,283 260,285 272 C 294 321,313 311,318 256 C 326 173,316 88,299 95 M97 114 C 91 116,78 129,70.174 141 C 40 184,46 237,84.368 274 C 95 285,97 286,108 286 C 132 286,168 270,211 239 C 220 232,249 208,250 205 C 254 200,252 193,245 188 C 243 186,239 183,236 180 C 194 140,121 105,97 114 M130 148 C 136 150,170 166,188 180 C 191 182,196 186,199 189 C 210 197,209 201,196 212 C 163 239,129 256,113 252 C 109 251,98 240,94 233 C 78 208,83 173,104 153 C 112 146,118 145,130 148"
            fill="var(--background-color)"
          ></path>
        </svg>
        <div class="about__text">
          <h2 class="about__name">Cogno</h2>
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
      align-items: center;
      display: flex;
      gap: 0.85rem;
    }

    .about__logo {
      flex: none;
      height: 3rem;
      width: 3rem;
    }

    .about__text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
    }

    .about__name {
      font-size: 1.25rem;
      font-weight: 600;
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
