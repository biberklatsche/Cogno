import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import { Opener } from "@cogno/platform";
import { IconComponent, TooltipDirective, TreeComponent, TreeRowDirective } from "@cogno/shared/ui";
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

@Component({
  selector: "app-remote-side",
  standalone: true,
  imports: [IconComponent, TooltipDirective, TreeComponent, TreeRowDirective],
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
        <button type="button" class="button icon-button" appTooltip="Refresh" (click)="refresh()">
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
          <label>
            <span>Name</span>
            <input
              type="text"
              spellcheck="false"
              autocomplete="off"
              placeholder="office"
              [value]="edited.name"
              [disabled]="edited.saving"
              (input)="setField('name', $event)"
            />
          </label>
          <label>
            <span>Destination</span>
            <input
              type="text"
              spellcheck="false"
              autocomplete="off"
              placeholder="user@host or an ssh alias"
              [value]="edited.destination"
              [disabled]="edited.saving"
              (input)="setField('destination', $event)"
            />
          </label>
          <label>
            <span>Command (optional)</span>
            <input
              type="text"
              spellcheck="false"
              autocomplete="off"
              placeholder='".cogno/bin/cogno" server --stdio'
              [value]="edited.command"
              [disabled]="edited.saving"
              (input)="setField('command', $event)"
            />
          </label>
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
              <div class="host-row" (mouseleave)="disarm()">
                <span class="connection" [class]="node.host.connection"></span>
                <span class="name" [appTooltip]="node.host.destination">{{ node.host.name }}</span>
                @if (node.host.connection === "connected") {
                  <button
                    type="button"
                    class="button text-button"
                    appTooltip="Its shells run on; the ones shown here close"
                    (click)="disconnect(node.host)"
                  >
                    Disconnect
                  </button>
                } @else if (node.host.connection !== "connecting") {
                  <button type="button" class="button text-button" (click)="connect(node.host)">
                    Connect
                  </button>
                }
                <button
                  type="button"
                  class="button icon-button row-action"
                  appTooltip="Change"
                  (click)="edit(node.host)"
                >
                  <app-icon name="mdiPencil"></app-icon>
                </button>
                <button
                  type="button"
                  class="button icon-button row-action danger"
                  [class.armed]="isArmed('remove', node.host.name)"
                  [appTooltip]="isArmed('remove', node.host.name) ? 'Click again to remove it' : 'Remove'"
                  (click)="remove(node.host)"
                >
                  <app-icon name="mdiTrashCanOutline"></app-icon>
                </button>
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
              <div class="shell-row" (mouseleave)="disarm()">
                <button
                  type="button"
                  class="shell"
                  [appTooltip]="node.shell.directory ?? ''"
                  (click)="show(node.hostName, node.shell)"
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
                  <button
                    type="button"
                    class="button icon-button row-action danger"
                    [class.armed]="isArmed('end', node.shell.terminalId)"
                    [appTooltip]="isArmed('end', node.shell.terminalId) ? 'Click again to end it' : 'End the shell'"
                    (click)="end(node.hostName, node.shell)"
                  >
                    <app-icon name="mdiClose"></app-icon>
                  </button>
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
      width: 20px;
      height: 20px;
      padding: 2px;
      visibility: hidden;
    }

    .row-action app-icon {
      width: 14px;
      height: 14px;
    }

    .host-row:hover > .row-action,
    .host-row:focus-within > .row-action,
    .shell-row:hover > .row-action,
    .shell-row:focus-within > .row-action,
    .row-action.armed {
      visibility: visible;
    }

    /* Red only under the pointer or once armed, like the git panel's discard. */
    .row-action.danger:hover,
    .row-action.danger.armed {
      color: var(--color-red);
      background: color-mix(in srgb, var(--color-red) 12%, var(--background-color));
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

  /** The action that the next click on the same button carries out. */
  private readonly armed = signal<string | null>(null);

  /** The tree the panel shows: the hosts with what runs on them. */
  readonly nodes = computed(() => hostNodes(this.panel.hosts(), this.panel.shells()));
  readonly childrenOf = (node: RemoteTreeNode): readonly RemoteTreeNode[] => node.children;
  readonly keyOf = (node: RemoteTreeNode): string => node.key;

  constructor(
    private readonly panel: RemotePanelService,
    private readonly opener: Opener,
  ) {}

  isArmed(action: string, target: string): boolean {
    return this.armed() === `${action}:${target}`;
  }

  disarm(): void {
    this.armed.set(null);
  }

  refresh(): void {
    this.panel.refresh();
  }

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

  setField(field: "name" | "destination" | "command", event: Event): void {
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

  connect(host: RemoteHost): void {
    this.panel.connect(host.name);
  }

  disconnect(host: RemoteHost): void {
    void this.panel.disconnect(host.name);
  }

  /** Asks once more before the machine leaves the config. */
  remove(host: RemoteHost): void {
    if (!this.confirmed("remove", host.name)) return;
    void this.panel.removeHost(host.name);
  }

  show(host: string, shell: RemoteShell): void {
    void this.panel.show(host, shell);
  }

  /** Asks once more before the shell and what runs in it end. */
  end(host: string, shell: RemoteShell): void {
    if (!this.confirmed("end", shell.terminalId)) return;
    void this.panel.end(host, shell);
  }

  /** The first click arms the action, the second one confirms it. */
  private confirmed(action: string, target: string): boolean {
    const key = `${action}:${target}`;
    if (this.armed() !== key) {
      this.armed.set(key);
      return false;
    }
    this.armed.set(null);
    return true;
  }
}
