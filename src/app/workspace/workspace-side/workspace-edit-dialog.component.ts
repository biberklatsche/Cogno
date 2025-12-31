import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {WorkspaceConfigUi, WorkspaceService} from "../+state/workspace.service";
import {AutofocusDirective} from "../../common/autofocus/autofocus.directive";
import {DialogRef, DIALOG_DATA} from "../../common/dialog";

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
             [value]="name()"
             (input)="onNameInput($event)"
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
export class WorkspaceEditDialogComponent implements OnInit, OnDestroy {
  constructor(public workspaceService: WorkspaceService, private readonly dialogRef: DialogRef<void>) {}

    ngOnDestroy(): void {
        this.workspaceService.registerKeybindListener();
    }

    ngOnInit(): void {
        this.workspaceService.unregisterKeybindListener();
    }

  // Workspace to edit is passed via dialog data
  readonly workspace = inject<WorkspaceConfigUi>(DIALOG_DATA);
  readonly name = signal<string>(this.workspace?.name ?? '');

  onNameInput(event: Event) {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.name.set(value);
  }

  onSave() {
    const newName = this.name().trim();
    if (!this.workspace || newName.length === 0) {
      this.dialogRef.close();
      return;
    }
    this.workspace.name = newName;
    // Persist via service
    void this.workspaceService.save(this.workspace);
    this.dialogRef.close();
  }

  onCancel() {
    this.dialogRef.close();
  }
}
