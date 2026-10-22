import { ChangeDetectionStrategy, Component, computed, Signal } from "@angular/core";
import { UpdaterState } from "@cogno/platform/updater";
import { UpdaterService } from "./updater.service";

@Component({
  selector: "app-updater-side",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="updater-panel">
      <div class="row">
        <div class="label">Installed</div>
        <div class="value">{{ state()?.currentVersion ?? "-" }}</div>
      </div>
      <div class="status">{{ statusText() }}</div>

      @if (state()?.notes; as notes) {
        <div class="section-title">What's new</div>
        <div class="notes">{{ notes }}</div>
      }

      <div class="actions">
        <button type="button" class="button" [disabled]="busy()" (click)="checkNow()">
          Check for updates
        </button>
        @if (canInstall()) {
          <button type="button" class="button primary" (click)="install()">
            {{ state()?.phase === "ready" ? "Restart to update" : "Update now" }}
          </button>
        }
        @if (mustDownload()) {
          <button type="button" class="button primary" (click)="openDownloadPage()">Download</button>
        }
      </div>
      @if (canInstall()) {
        <div class="hint">Cogno restarts; processes running in your terminals end.</div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .updater-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
      overflow-y: auto;
      padding: 0.25rem 0;
      font-size: 0.9rem;
    }

    .row {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 8px;
    }

    .label,
    .status,
    .hint {
      opacity: 0.7;
    }

    .section-title {
      font-weight: 600;
      margin-top: 4px;
    }

    .notes {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }
  `,
})
export class UpdaterSideComponent {
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
  readonly statusText = computed(() => statusText(this.state()));

  constructor(private readonly updaterService: UpdaterService) {
    this.state = this.updaterService.state;
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
