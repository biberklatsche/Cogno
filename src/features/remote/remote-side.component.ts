import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import { Opener } from "@cogno/platform";
import {
  CopyEditDeleteComponent,
  IconComponent,
  TooltipDirective,
  TreeComponent,
  TreeRowDirective,
} from "@cogno/shared/ui";
import { RemoteHostFormComponent } from "./remote-host-form.component";
import { RemotePairFormComponent } from "./remote-pair-form.component";
import { RemotePanelService } from "./remote-panel.service";
import { hostNodes, RemoteTreeNode } from "./remote-shell-tree";

const DOCUMENTATION_URL = "https://cogno.rocks/docs/remote-hosts/";

/** The form that is open: one to pair with a machine, or one to rename `host`. */
type OpenForm = { readonly kind: "pair" } | { readonly kind: "host"; readonly host: RemoteHost };

/** What the button next to a remote does. */
type NextStep = "connect" | "cancel" | "disconnect" | "remove";

/** What the action buttons of a line said. */
type RowAction = "copy" | "edit" | "delete";

@Component({
  selector: "app-remote-side",
  standalone: true,
  imports: [
    CopyEditDeleteComponent,
    IconComponent,
    RemoteHostFormComponent,
    RemotePairFormComponent,
    TooltipDirective,
    TreeComponent,
    TreeRowDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="remote-panel">
      <header class="panel-header">
        <button
          type="button"
          class="button icon-button"
          appTooltip="How to set up a remote"
          (click)="openDocumentation()"
        >
          <app-icon name="mdiTooltipQuestion"></app-icon>
        </button>
        <button type="button" class="button icon-button" appTooltip="Refresh" (click)="panel.refresh()">
          <app-icon name="mdiRefresh" [class.spinning]="panel.refreshing()"></app-icon>
        </button>
        <button
          type="button"
          class="button icon-button"
          appTooltip="Pair with a machine"
          (click)="form.set({ kind: 'pair' })"
        >
          <app-icon name="mdiPlus"></app-icon>
        </button>
      </header>

      @if (failure(); as reason) {
        <div class="status failure">{{ reason }}</div>
      }

      @if (form(); as open) {
        @if (open.kind === "pair") {
          <app-remote-pair-form (closed)="form.set(null)"></app-remote-pair-form>
        } @else {
          <app-remote-host-form
            [host]="open.host"
            (closed)="form.set(null)"
          ></app-remote-host-form>
        }
      }

      @if (nodes().length === 0) {
        <div class="status">
          No remotes yet. Pair with another machine to open its shells here.
        </div>
      }

      <!-- Host, workspace, tab, shell. -->
      <app-tree class="hosts" [nodes]="nodes()" [childrenOf]="childrenOf" [keyOf]="keyOf">
        <ng-template appTreeRow [appTreeRowOf]="nodes()" let-node let-toggle="toggle" let-open="open">
          @switch (node.kind) {
            @case ("host") {
              <div class="host-row">
                <span class="connection" [class]="node.host.connection"></span>
                <span class="name">{{ node.host.name }}</span>
                <!-- Removing asks once more, as everywhere in the side panels. -->
                <app-copy-edit-delete
                  class="row-action"
                  (onEvent)="onHostAction($event, node.host)"
                ></app-copy-edit-delete>
                @switch (nextStep(node.host)) {
                  @case ("disconnect") {
                    <button
                      type="button"
                      class="button text-button"
                      appTooltip="Its shells run on; the ones shown here close"
                      (click)="panel.disconnect(node.host.id)"
                    >
                      Disconnect
                    </button>
                  }
                  @case ("cancel") {
                    <button
                      type="button"
                      class="button text-button"
                      (click)="panel.disconnect(node.host.id)"
                    >
                      Cancel
                    </button>
                  }
                  @case ("connect") {
                    <button
                      type="button"
                      class="button text-button"
                      (click)="panel.connect(node.host.id)"
                    >
                      Connect
                    </button>
                  }
                  @case ("remove") {
                    <!-- The other machine removed the pairing: nothing reaches it any more. -->
                    <button
                      type="button"
                      class="button text-button"
                      (click)="panel.removeHost(node.host.id)"
                    >
                      Remove
                    </button>
                  }
                }
              </div>
            }
            @case ("workspace") {
              <button
                type="button"
                class="branch workspace-name"
                [attr.aria-expanded]="open"
                (click)="toggle()"
              >
                {{ node.name }}
              </button>
            }
            @case ("tab") {
              <button type="button" class="branch" [attr.aria-expanded]="open" (click)="toggle()">
                {{ node.name }}
              </button>
            }
            @case ("status") {
              <div class="status" [class.failure]="node.failure">{{ node.text }}</div>
            }
            @case ("shell") {
              <div class="shell-row">
                <button
                  type="button"
                  class="shell"
                  [appTooltip]="node.shell.directory ?? ''"
                  (click)="panel.show(node.host, node.shell)"
                >
                  <app-icon class="shell-icon" name="mdiConsole"></app-icon>
                  <span class="name">{{ node.name }}</span>
                  @switch (node.shell.shown) {
                    @case ("thisWindow") {
                      <span class="shown this-window">This window</span>
                    }
                    @case ("otherWindow") {
                      <span class="shown">Other window</span>
                    }
                    @case ("otherCogno") {
                      <span class="shown">On {{ node.shell.shownBy ?? "another Cogno" }}</span>
                    }
                  }
                </button>
                @if (node.shell.shown === "nowhere") {
                  <!-- Ends the shell and what runs in it; asks once more. -->
                  <app-copy-edit-delete
                    class="row-action"
                    [enableEdit]="false"
                    deleteTooltip="End the shell"
                    (onEvent)="onShellAction($event, node.host, node.shell)"
                  ></app-copy-edit-delete>
                }
              </div>
            }
          }
        </ng-template>
      </app-tree>
    </div>
  `,
  styles: `
    :host {
      font-size: var(--panel-font-size);
      display: block;
      height: 100%;
    }

    .remote-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 2px;
      padding: 0.25rem 0;
    }

    .status {
      opacity: 0.7;
      font-size: 0.9rem;
      padding: 0.25rem 0;
      overflow-wrap: anywhere;
    }

    .status.failure {
      opacity: 1;
      color: var(--color-red);
    }

    /* Only the hosts scroll; header and form stay in place. */
    .hosts {
      flex: 1;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
    }

    /* A line fills what the tree leaves next to its arrow. */
    .host-row,
    .shell-row {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 26px;
    }

    .host-row > .name {
      font-weight: 600;
    }

    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: left;
    }

    .shell-icon {
      flex: none;
      width: 16px;
      height: 16px;
      opacity: 0.7;
    }

    /* Whether the machine is reached: grey, yellow while trying, green, red. */
    .connection {
      flex: none;
      width: 8px;
      height: 8px;
      margin: 0 4px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--foreground-color) 35%, transparent);
    }

    .connection.connecting {
      background: var(--color-yellow);
    }

    .connection.connected {
      background: var(--color-green);
    }

    .connection.failed {
      background: var(--color-red);
    }

    .text-button {
      flex: none;
      padding: 1px 8px;
      font-size: 0.85rem;
    }

    .row-action {
      flex: none;
      visibility: hidden;
    }

    .host-row:hover > .row-action,
    .host-row:focus-within > .row-action,
    .shell-row:hover > .row-action,
    .shell-row:focus-within > .row-action {
      visibility: visible;
    }

    /* A workspace or a tab: its name opens and closes what is under it. */
    button.branch {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: left;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      padding: 2px 0;
      cursor: pointer;
    }

    button.branch.workspace-name {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    button.shell {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      padding: 2px 4px;
      cursor: pointer;
    }

    .shown {
      flex: none;
      font-size: 0.75rem;
      padding: 0 6px;
      border-radius: 999px;
      color: var(--color-yellow);
      background: color-mix(in srgb, var(--color-yellow) 14%, transparent);
    }

    .spinning {
      animation: spin 0.9s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .shown.this-window {
      color: inherit;
      background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
    }
  `,
})
export class RemoteSideComponent {
  readonly failure = this.panel.failure;
  readonly form = signal<OpenForm | null>(null);

  /** The tree the panel shows: the hosts with what runs on them. */
  readonly nodes = computed(() => hostNodes(this.panel.hosts(), this.panel.shells()));
  readonly childrenOf = (node: RemoteTreeNode): readonly RemoteTreeNode[] => node.children;
  readonly keyOf = (node: RemoteTreeNode): string => node.key;

  constructor(
    protected readonly panel: RemotePanelService,
    private readonly opener: Opener,
  ) {}

  openDocumentation(): void {
    void this.opener.openUrl(DOCUMENTATION_URL);
  }

  edit(host: RemoteHost): void {
    this.form.set({ kind: "host", host });
  }

  protected nextStep(host: RemoteHost): NextStep {
    switch (host.connection) {
      case "connected":
        return "disconnect";
      case "connecting":
        return "cancel";
      case "failed":
        // It fails for good only when it is not paired any more.
        return host.failure?.worthRetrying === false ? "remove" : "connect";
      default:
        return "connect";
    }
  }

  /** Removing a remote asks once more, as everywhere in the side panels. */
  protected onHostAction(action: RowAction, host: RemoteHost): void {
    if (action === "edit") this.edit(host);
    if (action === "delete") void this.panel.removeHost(host.id);
  }

  protected onShellAction(action: RowAction, host: string, shell: RemoteShell): void {
    if (action === "delete") void this.panel.end(host, shell);
  }
}
