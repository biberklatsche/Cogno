import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import { Opener } from "@cogno/platform";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { RemotePanelService, shownElsewhere } from "./remote-panel.service";
import { groupShells, ShellGroup, shellName } from "./remote-shell-tree";

const DOCUMENTATION_URL = "https://cogno.rocks/docs/remote-hosts/";

/** The machine a form is about; `previousName` is set while one is changed. */
type HostForm = {
  readonly previousName?: string;
  readonly name: string;
  readonly destination: string;
  readonly command: string;
  readonly saving: boolean;
  readonly error?: string;
};

/** What the tree of one machine shows. */
type MachineTree =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly reason: string }
  | { readonly status: "loaded"; readonly groups: readonly ShellGroup[] };

@Component({
  selector: "app-remote-side",
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
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

      <div class="machines">
        <section class="machine">
          <div class="machine-row">
            <button
              type="button"
              class="node-toggle"
              [attr.aria-label]="isOpen('') ? 'Collapse' : 'Expand'"
              (click)="toggle('')"
            >
              <app-icon [name]="isOpen('') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
            </button>
            <app-icon class="machine-icon" name="mdiLaptop"></app-icon>
            <span class="name">This machine</span>
            @if (hasShellsShownElsewhere()) {
              <button
                type="button"
                class="button text-button"
                appTooltip="Show every shell here again that another Cogno shows"
                (click)="bringAllBack()"
              >
                Bring all back
              </button>
            }
          </div>
          @if (isOpen("")) {
            <ng-container
              *ngTemplateOutlet="treeTemplate; context: { $implicit: tree(''), host: '' }"
            ></ng-container>
          }
        </section>

        @for (host of hosts(); track host.name) {
          <section class="machine" (mouseleave)="disarm()">
            <div class="machine-row">
              @if (host.connection === "disconnected") {
                <span class="node-toggle"></span>
              } @else {
                <button
                  type="button"
                  class="node-toggle"
                  [attr.aria-label]="isOpen(host.name) ? 'Collapse' : 'Expand'"
                  (click)="toggle(host.name)"
                >
                  <app-icon [name]="isOpen(host.name) ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
                </button>
              }
              <span class="connection" [class]="host.connection"></span>
              <span class="name" [appTooltip]="host.destination">{{ host.name }}</span>
              @if (host.connection === "connected") {
                <button
                  type="button"
                  class="button text-button"
                  appTooltip="Its shells run on; the ones shown here close"
                  (click)="disconnect(host)"
                >
                  Disconnect
                </button>
              } @else if (host.connection !== "connecting") {
                <button type="button" class="button text-button" (click)="connect(host)">
                  Connect
                </button>
              }
              <button
                type="button"
                class="button icon-button row-action"
                appTooltip="Change"
                (click)="edit(host)"
              >
                <app-icon name="mdiPencil"></app-icon>
              </button>
              <button
                type="button"
                class="button icon-button row-action danger"
                [class.armed]="isArmed('remove', host.name)"
                [appTooltip]="isArmed('remove', host.name) ? 'Click again to remove it' : 'Remove'"
                (click)="remove(host)"
              >
                <app-icon name="mdiTrashCanOutline"></app-icon>
              </button>
            </div>
            @if (isOpen(host.name)) {
              @if (host.connection === "connecting") {
                <div class="status">Connecting to {{ host.destination }}...</div>
              } @else if (host.connection === "failed") {
                <div class="status failure">{{ host.failure }}</div>
              } @else if (host.connection === "connected") {
                <ng-container
                  *ngTemplateOutlet="treeTemplate; context: { $implicit: tree(host.name), host: host.name }"
                ></ng-container>
              }
            }
          </section>
        } @empty {
          <div class="status">
            No remotes yet. Add the machine whose shells you want to go on with from here.
          </div>
        }
      </div>
    </div>

    <!-- The shells of one machine ("" is this one): workspace, tab, shell. -->
    <ng-template #treeTemplate let-machine let-host="host">
      @if (!machine || machine.status === "loading") {
        <div class="status">Looking for shells...</div>
      } @else if (machine.status === "failed") {
        <div class="status failure">{{ machine.reason }}</div>
      } @else if (machine.groups.length === 0) {
        <div class="status">No shells are running.</div>
      } @else {
        <ul class="tree">
          @for (group of machine.groups; track group.name) {
            <li>
              <button
                type="button"
                class="branch group-name"
                [class.orphaned]="group.orphaned"
                [attr.aria-expanded]="isOpen(host, group.name)"
                (click)="toggle(host, group.name)"
              >
                <app-icon
                  class="node-toggle"
                  [name]="isOpen(host, group.name) ? 'mdiChevronDown' : 'mdiChevronRight'"
                ></app-icon>
                <span class="name">{{ group.name }}</span>
              </button>
              @if (isOpen(host, group.name)) {
              <ul class="tree">
                @for (tab of group.tabs; track tab.name) {
                  <li>
                    @if (tab.name) {
                      <button
                        type="button"
                        class="branch tab-name"
                        [attr.aria-expanded]="isOpen(host, group.name, tab.name)"
                        (click)="toggle(host, group.name, tab.name)"
                      >
                        <app-icon
                          class="node-toggle"
                          [name]="isOpen(host, group.name, tab.name) ? 'mdiChevronDown' : 'mdiChevronRight'"
                        ></app-icon>
                        <span class="name">{{ tab.name }}</span>
                      </button>
                    }
                    @if (isOpen(host, group.name, tab.name)) {
                    <ul class="tree shells">
                      @for (shell of tab.shells; track shell.terminalId) {
                        <li class="shell-row" (mouseleave)="disarm()">
                          <button
                            type="button"
                            class="shell"
                            [appTooltip]="shell.directory ?? ''"
                            (click)="show(host || undefined, shell)"
                          >
                            <app-icon class="shell-icon" name="mdiConsole"></app-icon>
                            <span class="name">{{ nameOf(shell) }}</span>
                            @if (shell.shownHere) {
                              <span class="shown here">Here</span>
                            } @else if (shell.shown) {
                              <span class="shown">On {{ shell.shownBy ?? "another Cogno" }}</span>
                            }
                          </button>
                          @if (!shell.shown) {
                            <button
                              type="button"
                              class="button icon-button row-action danger"
                              [class.armed]="isArmed('end', shell.terminalId)"
                              [appTooltip]="isArmed('end', shell.terminalId) ? 'Click again to end it' : 'End the shell'"
                              (click)="end(host || undefined, shell)"
                            >
                              <app-icon name="mdiClose"></app-icon>
                            </button>
                          }
                        </li>
                      }
                    </ul>
                    }
                  </li>
                }
              </ul>
              }
            </li>
          }
        </ul>
      }
    </ng-template>
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

    /* Only the machines scroll; header and form stay in place. */
    .machines {
      flex: 1;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
    }

    .machine {
      padding-bottom: 6px;
      margin-bottom: 6px;
      border-bottom: 1px solid color-mix(in srgb, var(--foreground-color) 15%, transparent);
    }

    .machine:last-child {
      border-bottom: 0;
    }

    .machine-row,
    .shell-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 26px;
    }

    .machine-row > .name {
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

    .machine-icon,
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

    .machine-row:hover > .row-action,
    .machine-row:focus-within > .row-action,
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

    .tree {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    /* What runs on a machine is set in under its name. */
    .machine > .tree,
    .machine > .status {
      padding-left: 20px;
    }

    .tree .tree {
      padding-left: 12px;
    }

    /* A shell has no arrow: it lines up with the names above it. */
    .tree.shells {
      padding-left: 20px;
    }

    /* A workspace or a tab: one line that opens and closes what is under it. */
    button.branch {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      border-radius: 4px;
    }

    button.branch:hover {
      background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
    }

    .node-toggle {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border: 0;
      background: transparent;
      color: inherit;
      padding: 0;
      opacity: 0.7;
    }

    button.node-toggle {
      cursor: pointer;
    }

    .node-toggle app-icon {
      width: 16px;
      height: 16px;
    }

    .group-name {
      padding: 4px 0 2px;
      font-size: 0.85rem;
      opacity: 0.7;
    }

    .group-name.orphaned {
      opacity: 1;
      color: var(--color-yellow);
    }

    .tab-name {
      padding: 2px 0;
    }

    .shell-row {
      border-radius: 4px;
    }

    .shell-row:hover {
      background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
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
  readonly hosts = this.panel.hosts;
  readonly failure = this.panel.failure;
  readonly form = signal<HostForm | null>(null);

  /** The machines, workspaces and tabs that are folded away; all are open at first. */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  /** The action that the next click on the same button carries out. */
  private readonly armed = signal<string | null>(null);

  private readonly trees = computed<ReadonlyMap<string, MachineTree>>(() => {
    const trees = new Map<string, MachineTree>();
    for (const [name, machine] of this.panel.shells()) {
      trees.set(
        name,
        machine.status === "loaded"
          ? { status: "loaded", groups: groupShells(machine.shells, name === "") }
          : machine,
      );
    }
    return trees;
  });

  readonly hasShellsShownElsewhere = computed(() => {
    const local = this.panel.shells().get("");
    return local?.status === "loaded" && local.shells.some(shownElsewhere);
  });

  constructor(
    private readonly panel: RemotePanelService,
    private readonly opener: Opener,
  ) {}

  tree(machine: string): MachineTree | undefined {
    return this.trees().get(machine);
  }

  nameOf(shell: RemoteShell): string {
    return shellName(shell);
  }

  /** Whether the branch at `path` (machine, workspace, tab) shows what is under it. */
  isOpen(...path: string[]): boolean {
    return !this.collapsed().has(JSON.stringify(path));
  }

  toggle(...path: string[]): void {
    const key = JSON.stringify(path);
    this.collapsed.update((collapsed) => {
      const next = new Set(collapsed);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

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

  show(host: string | undefined, shell: RemoteShell): void {
    void this.panel.show(host, shell);
  }

  bringAllBack(): void {
    void this.panel.bringAllBack();
  }

  /** Asks once more before the shell and what runs in it end. */
  end(host: string | undefined, shell: RemoteShell): void {
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
