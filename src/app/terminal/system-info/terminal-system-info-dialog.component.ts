import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit, inject, signal} from '@angular/core';
import {DIALOG_DATA, DialogRef} from '../../common/dialog';
import {TerminalId} from '../../grid-list/+model/model';
import {ProcessDetails, ProcessTreeSnapshot, TauriPty} from '../../_tauri/pty';
import {Logger} from '../../_tauri/logger';

export type TerminalSystemInfoDialogData = {
  terminalId: TerminalId;
};

@Component({
  selector: 'app-terminal-system-info-dialog',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 320px;
    }

    .row {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px;
      align-items: start;
      font-size: 0.9rem;
    }

    .label {
      opacity: 0.7;
    }

    .value {
      word-break: break-word;
    }

    .section-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .status {
      opacity: 0.7;
      font-size: 0.9rem;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
    }
  `],
  template: `
    <div class="container">
      @if (loading()) {
        <div class="status">Loading system information...</div>
      } @else if (error()) {
        <div class="status">{{ error() }}</div>
      } @else if (snapshot()) {
        <div>
          <div class="section-title">Process</div>
          <div class="row">
            <div class="label">Name</div>
            <div class="value">{{ root()?.name ?? '-' }}</div>
          </div>
          <div class="row">
            <div class="label">PID</div>
            <div class="value">{{ root()?.processId ?? '-' }}</div>
          </div>
          <div class="row">
            <div class="label">Command</div>
            <div class="value">{{ rootCommand() }}</div>
          </div>
          <div class="row">
            <div class="label">CWD</div>
            <div class="value">{{ root()?.currentWorkingDirectory ?? '-' }}</div>
          </div>
          <div class="row">
            <div class="label">Executable</div>
            <div class="value">{{ root()?.executablePath ?? '-' }}</div>
          </div>
          <div class="row">
            <div class="label">Status</div>
            <div class="value">{{ root()?.status ?? '-' }}</div>
          </div>
          <div class="row">
            <div class="label">CPU</div>
            <div class="value">{{ formatPercent(root()?.cpuUsagePercent) }}</div>
          </div>
          <div class="row">
            <div class="label">Memory</div>
            <div class="value">{{ formatBytes(root()?.memoryBytes) }}</div>
          </div>
          <div class="row">
            <div class="label">Virtual Memory</div>
            <div class="value">{{ formatBytes(root()?.virtualMemoryBytes) }}</div>
          </div>
          <div class="row">
            <div class="label">Runtime</div>
            <div class="value">{{ formatSeconds(root()?.runTimeSeconds) }}</div>
          </div>
          <div class="row">
            <div class="label">Children</div>
            <div class="value">{{ childrenCount() }}</div>
          </div>
          <div class="row">
            <div class="label">Child PIDs</div>
            <div class="value">{{ childPids() }}</div>
          </div>
        </div>
      }
      <div class="actions">
        <button type="button" class="button" (click)="close()">Close</button>
      </div>
    </div>
  `
})
export class TerminalSystemInfoDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(DialogRef<void>);
  private readonly data = inject<TerminalSystemInfoDialogData>(DIALOG_DATA);
  private refreshTimer?: number;
  private refreshInFlight = false;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly snapshot = signal<ProcessTreeSnapshot | null>(null);

  ngOnInit(): void {
    void this.load(true);
    this.refreshTimer = window.setInterval(() => {
      void this.load(false);
    }, 2000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer !== undefined) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  root(): ProcessDetails | null {
    return this.snapshot()?.rootProcess ?? null;
  }

  rootCommand(): string {
    const command = this.root()?.command ?? [];
    return command.length ? command.join(' ') : '-';
  }

  childrenCount(): number {
    const snapshot = this.snapshot();
    if (!snapshot) return 0;
    return snapshot.directChildren.length;
  }

  childPids(): string {
    const snapshot = this.snapshot();
    if (!snapshot) return '-';
    const ids = snapshot.directChildProcessIds ?? [];
    return ids.length ? ids.join(', ') : '-';
  }

  close() {
    this.dialogRef.close();
  }

  private async load(showLoading: boolean): Promise<void> {
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;
    try {
      if (showLoading) {
        this.loading.set(true);
      }
      const snapshot = await TauriPty.getProcessTreeByTerminalId(this.data.terminalId);
      console.log('##############snapshot', snapshot);
      this.snapshot.set(snapshot);
    } catch (err) {
      Logger.error(`Failed to load terminal system info: ${String(err)}`);
      this.error.set('Failed to load system information.');
    } finally {
      if (showLoading) {
        this.loading.set(false);
      }
      this.refreshInFlight = false;
    }
  }

  formatBytes(value?: number | null): string {
    if (value === null || value === undefined) return '-';
    if (value === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const sized = value / Math.pow(1024, idx);
    return `${sized.toFixed(sized >= 10 ? 1 : 2)} ${units[idx]}`;
  }

  formatSeconds(value?: number | null): string {
    if (value === null || value === undefined) return '-';
    const seconds = Math.floor(value);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  formatPercent(value?: number | null): string {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(1)}%`;
  }
}
