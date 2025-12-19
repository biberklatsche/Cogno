import {Component, DestroyRef, OnDestroy, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {ConfigService} from "../../config/+state/config.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {WorkspaceConfigUi, WorkspaceService} from "../+state/workspace.service";
import {AppBus} from "../../app-bus/app-bus";
import {KeybindService} from "../../keybinding/keybind.service";
import {WorkspaceConfig} from "../+model/workspace";

@Component({
  selector: 'app-workspace-side',
  standalone: true,
  templateUrl: "workspace-side.component.html",
  styleUrl: "workspace-side.component.scss"
})
export class WorkspaceSideComponent {

    workspaceList: Signal<WorkspaceConfigUi[]> = this.workspaceService.workspaceList;

    constructor(private workspaceService: WorkspaceService, private keybindService: KeybindService) {
        /*keybindService.registerListener('workspace', ['ArrowUp', 'ArrowDown'], (event) => {
            console.log('#####', event);
        });*/
    }
}
