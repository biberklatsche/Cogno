import {Component} from '@angular/core';
import {WorkspaceService} from "../+state/workspace.service";
import {AutofocusDirective} from "../../common/autofocus/autofocus.directive";
import {DialogRef} from "../../common/dialog";

@Component({
  selector: 'app-workspace-edit-dialog',
  standalone: true,
  imports: [AutofocusDirective],
  styles: [`
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
    .workspace-input {
      width: 100%;
      box-sizing: border-box;
    }
    .button {
      padding: 6px 10px;
      border-radius: var(--button-border-radius, 6px);
      border: 1px solid var(--background-color-20l);
      background: var(--background-color-10l);
      color: var(--foreground-color);
      cursor: pointer;
    }
    .button.primary {
      background: var(--background-color-20l);
    }
  `],
  template: `
    <div>
      <input class="workspace-input"
             type="text"
             placeholder="Enter a workspace name"
             [value]="workspaceService.editWorkspaceName()"
             (input)="workspaceService.setWorkspaceName($event)"
             (keydown.enter)="onSave()"
             (keydown.escape)="onCancel()"
             [appAutofocus]="true"/>

      <div class="actions">
        <button type="button" class="button" (click)="onCancel()">Cancel</button>
        <button type="button" class="button primary" (click)="onSave()">Save</button>
      </div>
    </div>
  `
})
export class WorkspaceEditDialogComponent {
  constructor(public workspaceService: WorkspaceService, private readonly dialogRef: DialogRef<void>) {}

  onSave() {
    this.workspaceService.confirmEdit();
    this.dialogRef.close();
  }

  onCancel() {
    this.workspaceService.closeEdit();
    this.dialogRef.close();
  }
}
