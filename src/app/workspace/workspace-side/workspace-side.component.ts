import {Component, Signal} from '@angular/core';
import {WorkspaceConfigUi, WorkspaceService} from "../+state/workspace.service";
import {IconComponent} from "../../icons/icon/icon.component";
import {CopyEditDeleteComponent} from "../../common/copy-edit-delete/copy-edit-delete.component";
import {AutofocusDirective} from "../../common/autofocus/autofocus.directive";
import {TooltipDirective} from "../../common/tooltip/tooltip.directive";

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
                            @if (workspaceService.editWorkspaceId() === workspace.id) {
                                <input class="workspace-input"
                                       #wsInput
                                       type="text"
                                       [value]="workspaceService.editWorkspaceName()"
                                       (input)="workspaceService.setWorkspaceName($event)"
                                       (keydown.enter)="workspaceService.confirmEdit()"
                                       (keydown.escape)="workspaceService.closeEdit()"
                                       [appAutofocus]="workspaceService.editWorkspaceId() === workspace.id"/>
                            } @else {
                                <div class="workspace-badge"
                                     [style.background-color]="workspace.color ? 'var(--color-' + workspace.color + ')' : undefined">
                                    {{ (workspace.name || '')[0] || '?' }}
                                </div>
                                <div class="workspace-name" [appTooltip]="workspace.name ?? ''">{{ workspace.name }}
                                </div>
                                @if (workspace.id !== 'WS_DEFAULT') {
                                    <div class="space"></div>
                                    <app-copy-edit-delete
                                            (onEvent)="editDelete($event, workspace)"></app-copy-edit-delete>
                                }
                            }
                        </div>
                    </li>
                }
                <li class="center">
                    <button class="button-borderless" (click)="addWorkspace()">
                        <app-icon name="mdiPlus"></app-icon>
                    </button>
                </li>
            </ul>
        </section>
    `,
    imports: [
        IconComponent,
        CopyEditDeleteComponent,
        AutofocusDirective,
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
            gap: 10px;
            padding: 10px;
            box-sizing: border-box;
            width: 100%;
        }

        .workspace-badge {
            width: 24px;
            min-width: 24px;
            height: 24px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            line-height: 0;
            color: var(--forground-color);
        }

        .workspace-name {
            font-size: 0.95rem;
            color: var(--color-text, inherit);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .space {
            flex: 1;
        }
        
    `]
})
export class WorkspaceSideComponent {

    workspaceList: Signal<WorkspaceConfigUi[]> = this.workspaceService.workspaceList;

    constructor(public workspaceService: WorkspaceService) {
    }

    addWorkspace() {
        this.workspaceService.addWorkspace();
    }

    editDelete(event: "copy" | "edit" | "delete", workspace: WorkspaceConfigUi) {
        if (event === 'edit') {
            this.workspaceService.startEdit(workspace.id, workspace.name);
        } else if (event === 'delete') {
            void this.workspaceService.deleteWorkspace(workspace.id);
        }
    }

    restoreWorkspace(workspace: WorkspaceConfigUi) {
        this.workspaceService.restoreWorkspace(workspace);
    }
}
