import { Component, Signal } from "@angular/core";
import { defaultWorkspaceIdContract } from "@cogno/core-sdk";
import { WorkspaceEntryViewModel, WorkspaceService } from "./workspace.service";

@Component({
  selector: "app-workspace-side",
  standalone: true,
  template: `
    <section class="workspace-side">
      <ul class="workspace-grid">
        @for (workspaceEntry of workspaceEntries(); track workspaceEntry.id) {
          <li class="workspace-tile center" [class.selected]="workspaceEntry.isSelected" (click)="restoreWorkspace(workspaceEntry.id)">
            <div class="workspace-tile__content">
              <div
                class="workspace-badge"
                [style.color]="workspaceEntry.id === defaultWorkspaceId ? 'var(--foreground-color)' : 'var(--background-color)'"
                [style.background-color]="workspaceEntry.color ? 'var(--color-' + workspaceEntry.color + ')' : 'var(--color-green)'"
              >
                {{ (workspaceEntry.name || "")[0] || "?" }}
              </div>
              <div class="workspace-text">
                <div class="workspace-name">{{ workspaceEntry.name }}</div>
                @if (workspaceEntry.autosave) {
                  <small class="workspace-autosave">Auto Save</small>
                }
              </div>

              @if (workspaceEntry.id !== defaultWorkspaceId) {
                <div class="space"></div>
                <button class="button icon-button" type="button" (click)="openEditWorkspaceDialog($event, workspaceEntry.id)">
                  edit
                </button>
                <button class="button icon-button" type="button" (click)="deleteWorkspace($event, workspaceEntry.id)">
                  del
                </button>
              }
            </div>
          </li>
        }
        <li class="center">
          <button class="button icon-button workspace-add-button" type="button" (click)="openCreateWorkspaceDialog()">+</button>
        </li>
      </ul>
    </section>
  `,
  styles: [
    `
      :host,
      .workspace-side {
        display: block;
      }

      .workspace-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        list-style: none;
        margin: 0;
        padding: 0;
        width: 100%;
      }

      .workspace-tile {
        border-radius: var(--button-border-radius);
        border: 1px solid var(--background-color-20l-ct);
        background-color: var(--background-color-20l-ct);
        opacity: 0.7;
        cursor: default;
        height: 3.5rem;
      }

      .workspace-tile:hover {
        background: var(--background-color-20l) !important;
        opacity: 1;
        outline: none;
      }

      .workspace-tile.selected {
        background: var(--background-color-20l);
        border: 1px solid var(--background-color-30l);
        outline: none;
        opacity: 1;
      }

      .center {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
      }

      .workspace-tile__content {
        display: flex;
        align-items: center;
        padding: 0.5rem 0.8rem;
        box-sizing: border-box;
        width: 100%;
      }

      .workspace-badge {
        width: 24px;
        min-width: 24px;
        height: 24px;
        font-size: 16px;
        border-radius: 50%;
        margin-right: 0.5rem;
        display: grid;
        place-items: center;
        line-height: 0;
        text-transform: capitalize;
      }

      .workspace-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        overflow: hidden;
      }

      .workspace-name {
        font-size: 1rem;
        color: var(--color-text, inherit);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 100%;
      }

      .workspace-autosave {
        font-size: 0.8rem;
      }

      .space {
        flex: 1;
      }

      .workspace-add-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4rem;
        line-height: 1;
        padding: 0;
      }
    `,
  ],
})
export class WorkspaceSideComponent {
  readonly workspaceEntries: Signal<WorkspaceEntryViewModel[]>;
  readonly defaultWorkspaceId = defaultWorkspaceIdContract;

  constructor(private readonly workspaceService: WorkspaceService) {
    this.workspaceEntries = this.workspaceService.workspaceEntries;
  }

  async restoreWorkspace(workspaceId: string): Promise<void> {
    await this.workspaceService.restoreWorkspace(workspaceId);
  }

  openCreateWorkspaceDialog(): void {
    this.workspaceService.openCreateWorkspaceDialog();
  }

  openEditWorkspaceDialog(event: Event, workspaceId: string): void {
    event.stopPropagation();
    this.workspaceService.openEditWorkspaceDialog(workspaceId);
  }

  async deleteWorkspace(event: Event, workspaceId: string): Promise<void> {
    event.stopPropagation();
    await this.workspaceService.deleteWorkspace(workspaceId);
  }
}
