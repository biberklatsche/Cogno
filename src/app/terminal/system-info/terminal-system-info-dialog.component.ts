import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal} from '@angular/core';
import {DIALOG_DATA} from '../../common/dialog';
import {TerminalId} from '../../grid-list/+model/model';
import {ProcessDetails, ProcessTreeSnapshot, TauriPty} from '../../_tauri/pty';
import {Logger} from '../../_tauri/logger';

export type TerminalSystemInfoDialogData = {
  terminalId: TerminalId;
};

type ProcessTreeNode = {
  readonly processDetails: ProcessDetails;
  readonly childProcessNodes: ProcessTreeNode[];
};

@Component({
  selector: 'app-terminal-system-info-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

    .process-tree {
      margin: 6px 0 0 16px;
      padding-left: 14px;
    }

    .process-node {
      margin-bottom: 10px;
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
            <div class="value">{{ rootProcessDetails()?.name ?? '-' }}</div>
          </div>
          <div class="row">
            <div class="label">PID</div>
            <div class="value">{{ rootProcessDetails()?.processId ?? '-' }}</div>
          </div>
          <div class="row">
            <div class="label">Status</div>
            <div class="value">{{ rootProcessDetails()?.status ?? '-' }}</div>
          </div>
          <div class="row">
            <div class="label">CPU</div>
            <div class="value">{{ formatPercent(rootProcessDetails()?.cpuUsagePercent) }}</div>
          </div>
          <div class="row">
            <div class="label">Memory</div>
            <div class="value">{{ formatBytes(rootProcessDetails()?.memoryBytes) }}</div>
          </div>
          <div class="row">
            <div class="label">CWD</div>
            <div class="value">{{ rootProcessDetails()?.currentWorkingDirectory ?? '-' }}</div>
          </div>
          <div class="row">
            <div class="label">Runtime</div>
            <div class="value">{{ formatSeconds(rootProcessDetails()?.runTimeSeconds) }}</div>
          </div>
        </div>
        <div>
          <div class="section-title">Child Processes</div>
          @if (rootChildProcessNodes().length === 0) {
            <div class="status">No child processes.</div>
          } @else {
            <ul class="process-tree">
              @for (processTreeNode of rootChildProcessNodes(); track processTreeNode.processDetails.processId) {
                <ng-container *ngTemplateOutlet="processTreeNodeTemplate; context: {$implicit: processTreeNode}"></ng-container>
              }
            </ul>
          }
        </div>
      }
    </div>
    <ng-template #processTreeNodeTemplate let-processTreeNode>
      <li class="process-node">
        <div class="row">
          <div class="label">Name</div>
          <div class="value">{{ processTreeNode.processDetails.name ?? '-' }}</div>
        </div>
        <div class="row">
          <div class="label">PID</div>
          <div class="value">{{ processTreeNode.processDetails.processId ?? '-' }}</div>
        </div>
        <div class="row">
          <div class="label">Status</div>
          <div class="value">{{ processTreeNode.processDetails.status ?? '-' }}</div>
        </div>
        <div class="row">
          <div class="label">CPU</div>
          <div class="value">{{ formatPercent(processTreeNode.processDetails.cpuUsagePercent) }}</div>
        </div>
        <div class="row">
          <div class="label">Memory</div>
          <div class="value">{{ formatBytes(processTreeNode.processDetails.memoryBytes) }}</div>
        </div>
        <div class="row">
          <div class="label">CWD</div>
          <div class="value">{{ processTreeNode.processDetails.currentWorkingDirectory ?? '-' }}</div>
        </div>
        <div class="row">
          <div class="label">Runtime</div>
          <div class="value">{{ formatSeconds(processTreeNode.processDetails.runTimeSeconds) }}</div>
        </div>
        @if (processTreeNode.childProcessNodes.length > 0) {
          <ul class="process-tree">
            @for (childProcessTreeNode of processTreeNode.childProcessNodes; track childProcessTreeNode.processDetails.processId) {
              <ng-container *ngTemplateOutlet="processTreeNodeTemplate; context: {$implicit: childProcessTreeNode}"></ng-container>
            }
          </ul>
        }
      </li>
    </ng-template>
  `
})
export class TerminalSystemInfoDialogComponent implements OnInit, OnDestroy {
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

  rootProcessDetails(): ProcessDetails | null {
    return this.snapshot()?.rootProcess ?? null;
  }

  rootChildProcessNodes(): ProcessTreeNode[] {
    const processTreeSnapshot = this.snapshot();
    if (processTreeSnapshot === null) {
      return [];
    }

    const processNodeByProcessIdentifier: Map<number, ProcessTreeNode> = new Map<number, ProcessTreeNode>();
    for (const processDetails of processTreeSnapshot.descendants) {
      processNodeByProcessIdentifier.set(processDetails.processId, {
        processDetails,
        childProcessNodes: []
      });
    }

    const rootChildProcessNodes: ProcessTreeNode[] = [];
    for (const processDetails of processTreeSnapshot.descendants) {
      const processNode = processNodeByProcessIdentifier.get(processDetails.processId);
      if (processNode === undefined) {
        continue;
      }

      if (processDetails.parentProcessId === processTreeSnapshot.rootProcessId) {
        rootChildProcessNodes.push(processNode);
        continue;
      }

      const parentProcessIdentifier = processDetails.parentProcessId;
      if (parentProcessIdentifier === null) {
        continue;
      }

      const parentProcessNode = processNodeByProcessIdentifier.get(parentProcessIdentifier);
      parentProcessNode?.childProcessNodes.push(processNode);
    }

    return rootChildProcessNodes;
  }

  private async load(showLoading: boolean): Promise<void> {
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;
    try {
      if (showLoading) {
        this.loading.set(true);
      }
      const snapshot = await TauriPty.getProcessTreeByTerminalId(this.data.terminalId);
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
