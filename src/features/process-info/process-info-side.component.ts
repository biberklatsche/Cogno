import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { ProcessDetails, ProcessTreeSnapshot } from "@cogno/platform/pty";
import {
  IconComponent,
  SideMenuSearchInputComponent,
  TooltipDirective,
  TreeComponent,
  TreeDetailDirective,
  TreeRowDirective,
} from "@cogno/shared/ui";
import { ProcessInfoService } from "./process-info.service";

export type ProcessTreeNode = {
  readonly processDetails: ProcessDetails;
  readonly childProcessNodes: ProcessTreeNode[];
};

@Component({
  selector: "app-process-info-side",
  standalone: true,
  imports: [
    IconComponent,
    SideMenuSearchInputComponent,
    TooltipDirective,
    TreeComponent,
    TreeRowDirective,
    TreeDetailDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="process-panel">
      <header class="panel-header">
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
      } @else if (snapshot(); as tree) {
        @if (terminateFailed() !== null) {
          <div class="status">Failed to terminate process {{ terminateFailed() }}.</div>
        }

        <!-- The shell: one line with what the whole tree uses; never terminated from here. -->
        <section class="shell">
          <div class="process-row">
            <button
              type="button"
              class="name"
              [attr.aria-expanded]="shellDetailsShown()"
              (click)="shellDetailsShown.set(!shellDetailsShown())"
            >
              {{ tree.rootProcess.name }}
            </button>
            <span class="memory" appTooltip="Memory of the shell and everything it started">
              {{ formatBytes(totalMemoryBytes()) }}
            </span>
            <span class="terminate-slot"></span>
          </div>
          @if (shellDetailsShown()) {
            <dl class="details">
              <dt>PID</dt>
              <dd>{{ tree.rootProcess.processId }}</dd>
              <dt>Own memory</dt>
              <dd>{{ formatBytes(tree.rootProcess.memoryBytes) }}</dd>
              <dt>Runtime</dt>
              <dd>{{ formatSeconds(tree.rootProcess.runTimeSeconds) }}</dd>
              <dt>CWD</dt>
              <dd>{{ tree.rootProcess.currentWorkingDirectory ?? "-" }}</dd>
            </dl>
          }
        </section>

        <app-side-menu-search-input
          class="filter"
          placeholder="Filter by name or PID"
          [value]="filter()"
          (query)="filter.set($event)"
        ></app-side-menu-search-input>

        @if (rootChildProcessNodes().length === 0) {
          <div class="status">{{ filtering() ? "No matching processes." : "No child processes." }}</div>
        } @else {
          <!-- One child process: a line with its name; the rest opens on a click on the name. -->
          <app-tree
            class="scrolling"
            [nodes]="rootChildProcessNodes()"
            [childrenOf]="childrenOf"
            [keyOf]="keyOf"
            [expandAll]="filtering()"
          >
            <ng-template appTreeRow let-processTreeNode>
              <div class="process-row process-node-row">
                <button
                  type="button"
                  class="name"
                  [attr.aria-expanded]="showsDetails(processTreeNode)"
                  [appTooltip]="processTreeNode.processDetails.name"
                  (click)="toggleDetails(processTreeNode)"
                >
                  {{ processTreeNode.processDetails.name }}
                </button>
                @if (noticeableStatus(processTreeNode.processDetails.status); as status) {
                  <span class="status-flag">{{ status }}</span>
                }
                <span class="memory">{{ formatBytes(processTreeNode.processDetails.memoryBytes) }}</span>
                <button
                  type="button"
                  class="button icon-button terminate"
                  appTooltip="Terminate process and its children"
                  [disabled]="terminating().has(processTreeNode.processDetails.processId)"
                  (click)="terminate(processTreeNode)"
                >
                  <app-icon name="mdiClose"></app-icon>
                </button>
              </div>
            </ng-template>
            <ng-template appTreeDetail let-processTreeNode>
              @if (showsDetails(processTreeNode)) {
                <dl class="details">
                  <dt>PID</dt>
                  <dd>{{ processTreeNode.processDetails.processId }}</dd>
                  <dt>Status</dt>
                  <dd>{{ processTreeNode.processDetails.status }}</dd>
                  <dt>Runtime</dt>
                  <dd>{{ formatSeconds(processTreeNode.processDetails.runTimeSeconds) }}</dd>
                  <dt>CWD</dt>
                  <dd>{{ processTreeNode.processDetails.currentWorkingDirectory ?? "-" }}</dd>
                </dl>
              }
            </ng-template>
          </app-tree>
        }
      }
    </div>
  `,
  styles: `
    :host {
      font-size: var(--panel-font-size);
      display: block;
      height: 100%;
    }

    .process-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0.25rem 0;
    }

    /* Filter and shell line stay in place above the tree. */
    .filter {
      flex: none;
      margin-bottom: 6px;
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

    .shell {
      flex: none;
      padding-bottom: 4px;
      margin-bottom: 6px;
      border-bottom: 1px solid color-mix(in srgb, var(--foreground-color) 15%, transparent);
    }

    .process-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 24px;
    }

    /* A process's line fills what the tree leaves next to its arrow. */
    .process-node-row {
      flex: 1;
      min-width: 0;
    }

    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: left;
    }

    button.name {
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      padding: 0;
      cursor: pointer;
    }

    .memory {
      flex: none;
      font-size: 0.85rem;
      font-variant-numeric: tabular-nums;
      color: color-mix(in srgb, var(--foreground-color) var(--opacity-strong), transparent);
    }

    /* Only a process that is not simply running or waiting carries its status in the line. */
    .status-flag {
      flex: none;
      font-size: 0.75rem;
      padding: 0 6px;
      border-radius: 999px;
      color: var(--color-yellow);
      background: color-mix(in srgb, var(--color-yellow) 14%, transparent);
    }

    /* The shell's line keeps the slot free, so the memory column lines up. */
    .button.terminate,
    .terminate-slot {
      flex: none;
      width: 18px;
      height: 18px;
    }

    .button.terminate {
      padding: 2px;
      visibility: hidden;
    }

    .process-row:hover > .terminate,
    .process-row:focus-within > .terminate,
    .terminate:disabled {
      visibility: visible;
    }

    .terminate app-icon {
      width: 14px;
      height: 14px;
    }

    /* Red only under the pointer, like the git panel's discard. */
    .button.terminate:hover:not(:disabled) {
      color: var(--color-red);
      background: color-mix(in srgb, var(--color-red) 12%, var(--background-color));
    }

    .details {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 2px 12px;
      margin: 2px 0 6px 0;
      font-size: 0.85rem;
    }

    .details dt {
      opacity: 0.7;
    }

    .details dd {
      margin: 0;
      word-break: break-word;
    }

    /* Only the child processes scroll; the shell above stays in place. */
    app-tree.scrolling {
      flex: 1;
      min-height: 0;
      /* Never sideways: the name gives way, memory and the terminate button stay in view. */
      overflow-x: hidden;
      overflow-y: auto;
    }
  `,
})
export class ProcessInfoSideComponent {
  readonly snapshot = this.processInfo.snapshot;
  readonly loading = this.processInfo.loading;
  readonly hasError = this.processInfo.hasError;
  readonly held = this.processInfo.held;
  readonly binding = this.processInfo.binding;
  readonly terminating = this.processInfo.terminating;
  readonly terminateFailed = this.processInfo.terminateFailed;

  readonly shellDetailsShown = signal(false);
  readonly filter = signal("");
  readonly filtering = computed(() => this.filter().trim() !== "");

  private readonly detailedProcessIdentifiers = signal<Set<number>>(new Set<number>());

  readonly rootChildProcessNodes = computed<ProcessTreeNode[]>(() => {
    const processTreeSnapshot = this.snapshot();
    if (processTreeSnapshot === null) {
      return [];
    }
    return filterProcessNodes(buildRootChildProcessNodes(processTreeSnapshot), this.filter());
  });

  readonly totalMemoryBytes = computed<number | undefined>(() => {
    const processTreeSnapshot = this.snapshot();
    if (processTreeSnapshot === null) {
      return undefined;
    }
    return processTreeSnapshot.descendants.reduce(
      (sum, processDetails) => sum + processDetails.memoryBytes,
      processTreeSnapshot.rootProcess.memoryBytes,
    );
  });

  constructor(private readonly processInfo: ProcessInfoService) {}

  toggleHold(): void {
    this.processInfo.toggleHold();
  }

  terminate(processTreeNode: ProcessTreeNode): void {
    void this.processInfo.terminate(processTreeNode.processDetails.processId);
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

  /** How the tree reads a process: what it started, and what tells it apart. */
  readonly childrenOf = (processTreeNode: ProcessTreeNode): ProcessTreeNode[] =>
    processTreeNode.childProcessNodes;
  readonly keyOf = (processTreeNode: ProcessTreeNode): number =>
    processTreeNode.processDetails.processId;

  showsDetails(processTreeNode: ProcessTreeNode): boolean {
    return this.detailedProcessIdentifiers().has(processTreeNode.processDetails.processId);
  }

  toggleDetails(processTreeNode: ProcessTreeNode): void {
    this.detailedProcessIdentifiers.update((detailed) =>
      toggled(detailed, processTreeNode.processDetails.processId),
    );
  }

  noticeableStatus(status: string): string | null {
    return noticeableStatus(status);
  }
}

function toggled(processIdentifiers: Set<number>, processIdentifier: number): Set<number> {
  const next = new Set<number>(processIdentifiers);
  if (!next.delete(processIdentifier)) {
    next.add(processIdentifier);
  }
  return next;
}

/** The states worth a look, as the backend names them: ended but not collected, or halted. */
const NOTICEABLE_STATUSES = new Set(["Zombie", "Dead", "Stop", "Tracing"]);

/** The status to show in a process's line: only one that is out of the ordinary. */
export function noticeableStatus(status: string): string | null {
  return NOTICEABLE_STATUSES.has(status) ? status : null;
}

/**
 * The tree narrowed to a query on name or PID: a matching process stays with
 * everything it started, and with the parents that lead to it.
 */
export function filterProcessNodes(
  processNodes: ProcessTreeNode[],
  query: string,
): ProcessTreeNode[] {
  const term = query.trim().toLowerCase();
  if (term === "") return processNodes;
  return processNodes.flatMap((processNode) => {
    const { name, processId } = processNode.processDetails;
    if (name.toLowerCase().includes(term) || String(processId).includes(term)) {
      return [processNode];
    }
    const childProcessNodes = filterProcessNodes(processNode.childProcessNodes, term);
    return childProcessNodes.length > 0 ? [{ ...processNode, childProcessNodes }] : [];
  });
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
