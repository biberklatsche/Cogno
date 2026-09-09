import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { ProcessDetails, ProcessTreeSnapshot } from "@cogno/platform/pty";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { ProcessInfoService } from "./process-info.service";

type ProcessTreeNode = {
  readonly processDetails: ProcessDetails;
  readonly childProcessNodes: ProcessTreeNode[];
};

@Component({
  selector: "app-process-info-side",
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="process-panel">
      <header class="panel-header">
        <span class="panel-title">Process Info</span>
        <button
          type="button"
          class="button icon-button"
          [class.is-active]="held()"
          [appTooltip]="held() ? 'Locked to this session (click to follow focus again)' : 'Lock to this session'"
          (click)="toggleHold()"
        >
          <app-icon [name]="held() ? 'mdiLock' : 'mdiLockOpen'"></app-icon>
        </button>
      </header>

      @if (binding() === "unbound") {
        <div class="status">No session focused.</div>
      } @else if (binding() === "closing" || binding() === "closed") {
        <div class="status">The session has ended.</div>
      } @else if (loading() && !snapshot()) {
        <div class="status">Loading process information...</div>
      } @else if (hasError() && !snapshot()) {
        <div class="status">Failed to load process information.</div>
      } @else if (snapshot()) {
        <div class="section">
          <div class="section-title">Process</div>
          <div class="row">
            <div class="label">Name</div>
            <div class="value">{{ rootProcessDetails()?.name ?? "-" }}</div>
          </div>
          <div class="row">
            <div class="label">PID</div>
            <div class="value">{{ rootProcessDetails()?.processId ?? "-" }}</div>
          </div>
          <div class="row">
            <div class="label">Status</div>
            <div class="value">{{ rootProcessDetails()?.status ?? "-" }}</div>
          </div>
          <div class="row">
            <div class="label">Memory</div>
            <div class="value">{{ formatBytes(rootProcessDetails()?.memoryBytes) }}</div>
          </div>
          <div class="row">
            <div class="label">Memory (Total)</div>
            <div class="value">{{ formatBytes(totalMemoryBytes()) }}</div>
          </div>
          <div class="row">
            <div class="label">CWD</div>
            <div class="value">{{ rootProcessDetails()?.currentWorkingDirectory ?? "-" }}</div>
          </div>
          <div class="row">
            <div class="label">Runtime</div>
            <div class="value">{{ formatSeconds(rootProcessDetails()?.runTimeSeconds) }}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Child Processes</div>
          @if (rootChildProcessNodes().length === 0) {
            <div class="status">No child processes.</div>
          } @else {
            <ul class="process-tree">
              @for (processTreeNode of rootChildProcessNodes(); track processTreeNode.processDetails.processId) {
                <ng-container
                  *ngTemplateOutlet="processTreeNodeTemplate; context: { $implicit: processTreeNode }"
                ></ng-container>
              }
            </ul>
          }
        </div>
      }
    </div>

    <ng-template #processTreeNodeTemplate let-processTreeNode>
      <li class="process-node">
        <div class="row process-name-row">
          <div class="node-toggle-cell">
            @if (hasChildren(processTreeNode)) {
              <button
                type="button"
                class="node-toggle"
                (click)="toggleExpanded(processTreeNode)"
                [attr.aria-label]="isExpanded(processTreeNode) ? 'Collapse child processes' : 'Expand child processes'"
              >
                {{ isExpanded(processTreeNode) ? "&#9662;" : "&#9656;" }}
              </button>
            }
          </div>
          <div class="label">Name</div>
          <div class="value">{{ processTreeNode.processDetails.name ?? "-" }}</div>
        </div>
        <div class="row">
          <div class="label">PID</div>
          <div class="value">{{ processTreeNode.processDetails.processId ?? "-" }}</div>
        </div>
        <div class="row">
          <div class="label">Status</div>
          <div class="value">{{ processTreeNode.processDetails.status ?? "-" }}</div>
        </div>
        <div class="row">
          <div class="label">Memory</div>
          <div class="value">{{ formatBytes(processTreeNode.processDetails.memoryBytes) }}</div>
        </div>
        <div class="row">
          <div class="label">CWD</div>
          <div class="value">{{ processTreeNode.processDetails.currentWorkingDirectory ?? "-" }}</div>
        </div>
        <div class="row">
          <div class="label">Runtime</div>
          <div class="value">{{ formatSeconds(processTreeNode.processDetails.runTimeSeconds) }}</div>
        </div>
        @if (hasChildren(processTreeNode) && isExpanded(processTreeNode)) {
          <ul class="process-tree">
            @for (childProcessTreeNode of processTreeNode.childProcessNodes; track childProcessTreeNode.processDetails.processId) {
              <ng-container
                *ngTemplateOutlet="processTreeNodeTemplate; context: { $implicit: childProcessTreeNode }"
              ></ng-container>
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .process-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
      overflow-y: auto;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.25rem 0;
    }

    .panel-title {
      font-weight: 600;
    }

    .icon-button.is-active {
      opacity: 1;
      color: var(--color-accent, inherit);
    }

    .status {
      opacity: 0.7;
      font-size: 0.9rem;
      padding: 0.25rem 0;
    }

    .section-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .row {
      display: grid;
      grid-template-columns: 120px 1fr;
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

    .process-tree {
      list-style: none;
      margin: 6px 0 0 0;
      padding-left: 0;
    }

    .process-node {
      margin-bottom: 10px;
    }

    .process-name-row {
      grid-template-columns: 18px 102px 1fr;
      column-gap: 0;
    }

    .process-node > .row:not(.process-name-row) {
      margin-left: 18px;
    }

    .node-toggle-cell {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      min-height: 1px;
    }

    .node-toggle {
      border: 0;
      background: transparent;
      color: inherit;
      padding: 0;
      width: 14px;
      text-align: center;
      line-height: 1;
      opacity: 0.8;
    }

    .process-node > .process-tree {
      margin-left: 18px;
    }
  `,
})
export class ProcessInfoSideComponent {
  readonly snapshot = this.processInfo.snapshot;
  readonly loading = this.processInfo.loading;
  readonly hasError = this.processInfo.hasError;
  readonly held = this.processInfo.held;
  readonly binding = this.processInfo.binding;

  private readonly collapsedProcessIdentifiers = signal<Set<number>>(new Set<number>());

  readonly rootProcessDetails = computed<ProcessDetails | null>(
    () => this.snapshot()?.rootProcess ?? null,
  );

  readonly rootChildProcessNodes = computed<ProcessTreeNode[]>(() => {
    const processTreeSnapshot = this.snapshot();
    if (processTreeSnapshot === null) {
      return [];
    }
    return buildRootChildProcessNodes(processTreeSnapshot);
  });

  readonly totalMemoryBytes = computed<number | null>(() => {
    const processTreeSnapshot = this.snapshot();
    if (processTreeSnapshot === null) {
      return null;
    }
    const rootMemoryBytes = processTreeSnapshot.rootProcess.memoryBytes ?? 0;
    const descendantsMemoryBytes = processTreeSnapshot.descendants.reduce(
      (sum, processDetails) => sum + (processDetails.memoryBytes ?? 0),
      0,
    );
    return rootMemoryBytes + descendantsMemoryBytes;
  });

  constructor(private readonly processInfo: ProcessInfoService) {}

  toggleHold(): void {
    this.processInfo.toggleHold();
  }

  formatBytes(value?: number | null): string {
    if (value === null || value === undefined) return "-";
    if (value === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const sized = value / 1024 ** idx;
    return `${sized.toFixed(sized >= 10 ? 1 : 2)} ${units[idx]}`;
  }

  formatSeconds(value?: number | null): string {
    if (value === null || value === undefined) return "-";
    const seconds = Math.floor(value);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  hasChildren(processTreeNode: ProcessTreeNode): boolean {
    return processTreeNode.childProcessNodes.length > 0;
  }

  isExpanded(processTreeNode: ProcessTreeNode): boolean {
    return !this.collapsedProcessIdentifiers().has(processTreeNode.processDetails.processId);
  }

  toggleExpanded(processTreeNode: ProcessTreeNode): void {
    if (!this.hasChildren(processTreeNode)) {
      return;
    }
    const processIdentifier = processTreeNode.processDetails.processId;
    this.collapsedProcessIdentifiers.update((collapsedProcessIdentifiers) => {
      const next = new Set<number>(collapsedProcessIdentifiers);
      if (next.has(processIdentifier)) {
        next.delete(processIdentifier);
      } else {
        next.add(processIdentifier);
      }
      return next;
    });
  }
}

function buildRootChildProcessNodes(processTreeSnapshot: ProcessTreeSnapshot): ProcessTreeNode[] {
  const processNodeByProcessIdentifier = new Map<number, ProcessTreeNode>();
  for (const processDetails of processTreeSnapshot.descendants) {
    processNodeByProcessIdentifier.set(processDetails.processId, {
      processDetails,
      childProcessNodes: [],
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
    processNodeByProcessIdentifier
      .get(parentProcessIdentifier)
      ?.childProcessNodes.push(processNode);
  }

  return rootChildProcessNodes;
}
