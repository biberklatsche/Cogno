import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  Signal,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ProcessDetails, ProcessTreeSnapshot, TauriPty } from "@cogno/app-tauri/pty";
import { Observable } from "rxjs";
import { DIALOG_DATA } from "../../common/dialog";
import { ErrorReporter } from "../../common/error/error-reporter";
import { TerminalId } from "../../grid-list/+model/model";
import { KeybindService } from "../../keybinding/keybind.service";
import { Command, TerminalState } from "../+state/state";

export type TerminalSystemInfoSource = {
  state$: Observable<TerminalState>;
  commands$: Observable<Command[]>;
};

export type TerminalSystemInfoDialogData = {
  terminalId: TerminalId;
  systemInfo: TerminalSystemInfoSource;
};

type ProcessTreeNode = {
  readonly processDetails: ProcessDetails;
  readonly childProcessNodes: ProcessTreeNode[];
};

@Component({
  selector: "app-terminal-system-info-dialog",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
    .container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 320px;
    }

    .tabs {
      display: inline-flex;
      gap: 6px;
      padding: 2px;
      border-radius: 8px;
      background: var(--background-color-10l);
      align-self: flex-start;
    }

    .tab {
      border: 0;
      background: transparent;
      color: inherit;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.85rem;
      opacity: 0.7;
      cursor: pointer;
    }

    .tab.is-active {
      opacity: 1;
      background: var(--background-color-20l);
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
      list-style: none;
      margin: 6px 0 0 0;
      padding-left: 0;
    }

    .process-node {
      margin-bottom: 10px;
    }

    .process-name-row {
      grid-template-columns: 18px 148px 1fr;
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
      cursor: pointer;
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
  ],
  template: `
    <div class="container">
      @if (loading()) {
        <div class="status">Loading system information...</div>
      } @else if (error()) {
        <div class="status">{{ error() }}</div>
      } @else if (snapshot()) {
        <div class="tabs" role="tablist" aria-label="System Info Tabs">
          <button
            type="button"
            role="tab"
            class="tab"
            [class.is-active]="activeTab() === 'process'"
            [attr.aria-selected]="activeTab() === 'process'"
            (click)="activeTab.set('process')">
            Process
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            [class.is-active]="activeTab() === 'terminal'"
            [attr.aria-selected]="activeTab() === 'terminal'"
            (click)="activeTab.set('terminal')">
            Terminal Session
          </button>
        </div>

        @if (activeTab() === 'terminal') {
          <div>
          <div class="section-title">Terminal Session</div>
          @if (terminalState(); as state) {
            <div class="row">
              <div class="label">Keybinding</div>
              <div class="value">
                @if (lastKeybinding()) {
                  {{ lastKeybinding() }}
                } @else {
                  -
                }
              </div>
            </div>
            <div class="row">
              <div class="label">Mouse (Viewport)</div>
              <div class="value">
                {{ state.mousePosition.viewport.col }}, {{ state.mousePosition.viewport.row }}, '{{ state.mousePosition.char || ' ' }}'
              </div>
            </div>
            <div class="row">
              <div class="label">Mouse (Absolute)</div>
              <div class="value">
                {{ state.mousePosition.col }}, {{ state.mousePosition.row }}, '{{ state.mousePosition.char || ' ' }}'
              </div>
            </div>
            <div class="row">
              <div class="label">Cursor (Viewport)</div>
              <div class="value">
                {{ state.cursorPosition.viewport.col }}, {{ state.cursorPosition.viewport.row }}, '{{ state.cursorPosition.char || ' ' }}'
              </div>
            </div>
            <div class="row">
              <div class="label">Cursor (Absolute)</div>
              <div class="value">
                {{ state.cursorPosition.col }}, {{ state.cursorPosition.row }}, '{{ state.cursorPosition.char || ' ' }}'
              </div>
            </div>
            <div class="row">
              <div class="label">Terminal Size</div>
              <div class="value">
                {{ state.dimensions.cols }} x {{ state.dimensions.rows }}
              </div>
            </div>
            <div class="row">
              <div class="label">Cell Size</div>
              <div class="value">
                {{ state.dimensions.cellHeight }} x {{ state.dimensions.cellWidth }}
              </div>
            </div>
            <div class="row">
              <div class="label">Input</div>
              <div class="value">
                @if (state.input.text) {
                  {{ state.input.text }}
                } @else {
                  -
                }
              </div>
            </div>
            <div class="row">
              <div class="label">Busy</div>
              <div class="value">{{ state.isCommandRunning }}</div>
            </div>
            <div class="row">
              <div class="label">Full Screen</div>
              <div class="value">{{ state.isInFullScreenMode }}</div>
            </div>
            <div class="row">
              <div class="label">Last Commands</div>
              <div class="value">
                @if (terminalCommands().length > 0) {
                  @for (cmd of lastCommands(terminalCommands()); track cmd.id) {
                    <div>{{ cmd.id }} {{ cmd.command ?? '-' }}</div>
                  }
                } @else {
                  -
                }
              </div>
            </div>
          }
        </div>
        }

        @if (activeTab() === 'process') {
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
            <div class="label">Memory</div>
            <div class="value">{{ formatBytes(rootProcessDetails()?.memoryBytes) }}</div>
          </div>
          <div class="row">
            <div class="label">Memory (Total)</div>
            <div class="value">{{ formatBytes(totalMemoryBytes()) }}</div>
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
                [attr.aria-label]="isExpanded(processTreeNode) ? 'Collapse child processes' : 'Expand child processes'">
                {{ isExpanded(processTreeNode) ? '&#9662;' : '&#9656;' }}
              </button>
            }
          </div>
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
        @if (hasChildren(processTreeNode) && isExpanded(processTreeNode)) {
          <ul class="process-tree">
            @for (childProcessTreeNode of processTreeNode.childProcessNodes; track childProcessTreeNode.processDetails.processId) {
              <ng-container *ngTemplateOutlet="processTreeNodeTemplate; context: {$implicit: childProcessTreeNode}"></ng-container>
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
})
export class TerminalSystemInfoDialogComponent implements OnInit, OnDestroy {
  private refreshTimer?: number;
  private refreshInFlight = false;

  readonly activeTab = signal<"process" | "terminal">("process");
  readonly terminalState: Signal<TerminalState | null> = toSignal(this.data.systemInfo.state$, {
    initialValue: null,
  });
  readonly lastKeybinding = this.keybindService.lastFiredKeybinding;
  readonly terminalCommands = toSignal(this.data.systemInfo.commands$, { initialValue: [] });
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly snapshot = signal<ProcessTreeSnapshot | null>(null);
  readonly collapsedProcessIdentifiers = signal<Set<number>>(new Set<number>());

  constructor(
    @Inject(DIALOG_DATA) private readonly data: TerminalSystemInfoDialogData,
    private readonly keybindService: KeybindService,
  ) {}

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

    const processNodeByProcessIdentifier: Map<number, ProcessTreeNode> = new Map<
      number,
      ProcessTreeNode
    >();
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
      ErrorReporter.reportException({
        error: err,
        handled: true,
        source: "TerminalSystemInfoDialogComponent",
        context: {
          operation: "load",
          showLoading,
          terminalId: this.data.terminalId,
        },
      });
      this.error.set("Failed to load system information.");
    } finally {
      if (showLoading) {
        this.loading.set(false);
      }
      this.refreshInFlight = false;
    }
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

  totalMemoryBytes(): number | null {
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
      const nextCollapsedProcessIdentifiers = new Set<number>(collapsedProcessIdentifiers);
      if (nextCollapsedProcessIdentifiers.has(processIdentifier)) {
        nextCollapsedProcessIdentifiers.delete(processIdentifier);
      } else {
        nextCollapsedProcessIdentifiers.add(processIdentifier);
      }
      return nextCollapsedProcessIdentifiers;
    });
  }

  lastCommands(commands: Command[]): Command[] {
    if (!commands?.length) return [];
    return commands.slice(-5).reverse();
  }
}
