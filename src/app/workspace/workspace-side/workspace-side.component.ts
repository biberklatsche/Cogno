import {Component, Signal} from '@angular/core';
import {DEFAULT_WORKSPACE_ID, WorkspaceConfigUi, WorkspaceService} from "../+state/workspace.service";
import {IconComponent} from "../../icons/icon/icon.component";
import {CopyEditDeleteComponent} from "../../common/copy-edit-delete/copy-edit-delete.component";
import {TooltipDirective} from "../../common/tooltip/tooltip.directive";
import {DialogService} from "../../common/dialog";
import {WorkspaceEditDialogComponent} from "./workspace-edit-dialog.component";

@Component({
    selector: 'app-workspace-side',
    standalone: true,
    template: `
        <section class="workspace-side">
            <ul class="workspace-grid">
                @for (workspace of workspaceList(); track workspace.name) {
                    <li class="workspace-tile center" [class.selected]="workspace.isSelected"
                        (click)="restoreWorkspace(workspace)">
                        <div class="workspace-tile__content">
                            <div class="workspace-badge"
                                 [style.color]="workspace.id === DEFAULT_WORKSPACE_ID ? 'var(--foreground-color)' : 'var(--background-color)' "
                                 [style.background-color]="workspace.color ? 'var(--color-' + workspace.color + ')' : 'var(--color-green)'">
                                {{ (workspace.name || '')[0] || '?' }}
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center">
                                <div class="workspace-name" [appTooltip]="workspace.name">{{ workspace.name }}</div>
                                @if(workspace.autosave) {
                                    <small class="workspace-autosave" >Auto Save</small>
                                }
                            </div>
                            
                            @if (workspace.id !== DEFAULT_WORKSPACE_ID) {
                                <div class="space"></div>
                                <app-copy-edit-delete
                                        (onEvent)="editDelete($event, workspace)"></app-copy-edit-delete>
                            }
                        </div>
                    </li>
                }
                <li class="center">
                    <button class="button icon-button" (click)="addWorkspace()">
                        <app-icon name="mdiPlus"></app-icon>
                    </button>
                </li>
            </ul>
        </section>
    `,
    imports: [
        IconComponent,
        CopyEditDeleteComponent,
        TooltipDirective
    ],
    styles: [`
        :host, .workspace-side {
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

            &:hover {
                background: var(--background-color-20l) !important;
                opacity: 1;
                outline: none;
            }

            &.selected {
                background: var(--background-color-20l);
                border: 1px solid var(--background-color-30l);
                outline: none;
                opacity: 1;
            }
        }
        
        .center {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
        }

        /* Inhalt: Icon/Badge + Name */
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
            color: var(--forground-color);
            text-transform: capitalize;
        }

        .workspace-name {
            font-size: 1rem;
            color: var(--color-text, inherit);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .workspace-autosave {
            font-size: 0.8rem;
        }
        
        .space {
            flex: 1;
        }
        
    `]
})
export class WorkspaceSideComponent {

    workspaceList: Signal<WorkspaceConfigUi[]> = this.workspaceService.workspaceList;

    constructor(public workspaceService: WorkspaceService, private readonly dialog: DialogService) {
    }

    addWorkspace() {
        const draft = this.workspaceService.createWorkspaceDraft();
        this.dialog.open(WorkspaceEditDialogComponent, {
            title: 'Create workspace',
            width: '420px',
            showCloseButton: true,
            data: draft,
        });
    }

    editDelete(event: "copy" | "edit" | "delete", workspace: WorkspaceConfigUi) {
        if (event === 'edit') {
            this.dialog.open(WorkspaceEditDialogComponent, {
                title: `Edit ${workspace.name}`,
                width: '420px',
                showCloseButton: true,
                data: workspace,
            });
        } else if (event === 'delete') {
            void this.workspaceService.deleteWorkspace(workspace.id);
        }
    }

    restoreWorkspace(workspace: WorkspaceConfigUi) {
        this.workspaceService.restoreWorkspace(workspace);
    }

    DEFAULT_WORKSPACE_ID = DEFAULT_WORKSPACE_ID;
}
