import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { RemoteHost } from "@cogno/core/api/remote-shells-port";
import { Opener } from "@cogno/platform";
import {
  CopyEditDeleteComponent,
  IconComponent,
  TooltipDirective,
  TreeComponent,
  TreeRowDirective,
} from "@cogno/shared/ui";
import { RemotePanelService } from "./remote-panel.service";
import { hostNodes, RemoteTreeNode } from "./remote-shell-tree";

const DOCUMENTATION_URL = "https://cogno.rocks/docs/remote-hosts/";

/** The host a form is about; `previousName` is set while one is changed. */
type HostForm = {
  readonly previousName?: string;
  readonly name: string;
  readonly destination: string;
  readonly command: string;
  readonly saving: boolean;
  readonly error?: string;
};

/** The form's fields, in the order they are shown. */
const HOST_FIELDS = [
  { key: "name", label: "Name", placeholder: "office" },
  { key: "destination", label: "Destination", placeholder: "user@host or an ssh alias" },
  {
    key: "command",
    label: "Command (optional)",
    placeholder: '".cogno/bin/cogno" server --stdio',
  },
] as const;

@Component({
  selector: "app-remote-side",
  standalone: true,
  imports: [
    CopyEditDeleteComponent,
    IconComponent,
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
          <app-icon name="mdiRefresh"></app-icon>
        </button>
        <button type="button" class="button icon-button" appTooltip="Add a remote" (click)="add()">
          <app-icon name="mdiPlus"></app-icon>
        </button>
      </header>

      @if (failure(); as reason) {
        <div class="status failure">{{ reason }}</div>
      }

      @if (form(); as edited) {
        <form class="host-form" (submit)="save($event)">
          @for (field of fields; track field.key) {
            <label>
              <span>{{ field.label }}</span>
              <input
                type="text"
                spellcheck="false"
                autocomplete="off"
                [placeholder]="field.placeholder"
                [value]="edited[field.key]"
                [disabled]="edited.saving"
                (input)="setField(field.key, $event)"
              />
            </label>
          }
          @if (edited.error) {
            <div class="status failure">{{ edited.error }}</div>
          }
          <div class="form-actions">
            <button type="button" class="button" [disabled]="edited.saving" (click)="form.set(null)">
              Cancel
            </button>
            <button type="submit" class="button" [disabled]="edited.saving">Save</button>
          </div>
        </form>
      }

      @if (nodes().length === 0) {
        <div class="status">
          No remotes yet. Add the machine whose shells you want to go on with from here.
        </div>
      }

      <!-- Host, workspace, tab, shell. -->
      <app-tree class="hosts" [nodes]="nodes()" [childrenOf]="childrenOf" [keyOf]="keyOf">
        <ng-template appTreeRow let-node let-toggle="toggle" let-open="open">
          @switch (node.kind) {
            @case ("host") {
              <div class="host-row">
                <span class="connection" [class]="node.host.connection"></span>
                <span class="name" [appTooltip]="node.host.destination">{{ node.host.name }}</span>
                @if (node.host.connection === "connected") {
                  <button
                    type="button"
                    class="button text-button"
                    appTooltip="Its shells run on; the ones shown here close"
                    (click)="panel.disconnect(node.host.name)"
                  >
                    Disconnect
                  </button>
                } @else if (node.host.connection !== "connecting") {
                  <button
                    type="button"
                    class="button text-button"
                    (click)="panel.connect(node.host.name)"
                  >
                    Connect
                  </button>
                }
                <!-- Removing asks once more, as everywhere in the side panels. -->
                <app-copy-edit-delete
                  class="row-action"
                  (onEvent)="$event === 'edit' ? edit(node.host) : panel.removeHost(node.host.name)"
                ></app-copy-edit-delete>
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
                  (click)="panel.show(node.hostName, node.shell)"
                >
                  <app-icon class="shell-icon" name="mdiConsole"></app-icon>
                  <span class="name">{{ node.name }}</span>
                  @if (node.shell.shown === "here") {
                    <span class="shown here">Here</span>
                  } @else if (node.shell.shown === "elsewhere") {
                    <span class="shown">On {{ node.shell.shownBy ?? "another Cogno" }}</span>
                  }
                </button>
                @if (node.shell.shown === "nowhere") {
                  <!-- Ends the shell and what runs in it; asks once more. -->
                  <app-copy-edit-delete
                    class="row-action"
                    [enableEdit]="false"
                    (onEvent)="$event === 'delete' && panel.end(node.hostName, node.shell)"
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

    .host-form {
      flex: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-bottom: 8px;
      margin-bottom: 6px;
      border-bottom: 1px solid color-mix(in srgb, var(--foreground-color) 15%, transparent);
    }

    .host-form label {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .host-form label span {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    .host-form input {
      min-width: 0;
      background: var(--background-color);
      color: var(--foreground-color);
      border: 1px solid color-mix(in srgb, var(--foreground-color) 20%, transparent);
      border-radius: var(--button-border-radius);
      padding: 0.3rem 0.4rem;
      font: inherit;
    }

    .host-form input:focus {
      outline: none;
      border-color: var(--highlight-color);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
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

    .shown.here {
      color: inherit;
      background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
    }
  `,
})
export class RemoteSideComponent {
  readonly failure = this.panel.failure;
  readonly form = signal<HostForm | null>(null);
  readonly fields = HOST_FIELDS;

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

  add(): void {
    this.form.set({ name: "", destination: "", command: "", saving: false });
  }

  edit(host: RemoteHost): void {
    this.form.set({
      previousName: host.name,
      name: host.name,
      destination: host.destination,
      command: host.command ?? "",
      saving: false,
    });
  }

  setField(field: (typeof HOST_FIELDS)[number]["key"], event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.form.update((edited) => edited && { ...edited, [field]: value, error: undefined });
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const edited = this.form();
    if (!edited || edited.saving) return;
    this.form.set({ ...edited, saving: true, error: undefined });
    const error = await this.panel.saveHost(
      { name: edited.name, destination: edited.destination, command: edited.command || undefined },
      edited.previousName,
    );
    this.form.set(error === undefined ? null : { ...edited, saving: false, error });
  }
}
