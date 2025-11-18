import {DestroyRef, Injectable} from "@angular/core";
import {AppBus} from "../../app-bus/app-bus";
import {IdCreator} from "../../common/id-creator/id-creator";
import {TerminalConfig, GridConfig, SplitNode, WorkspaceConfig} from "../+model/workspace";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ConfigService} from "../../config/+state/config.service";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {WorkspaceSideComponent} from "../workspace-side/workspace-side.component";

@Injectable({providedIn: 'root'})
export class WorkspaceService {

    constructor(private bus: AppBus, conf: ConfigService, sideMenuService: SideMenuService, ref: DestroyRef) {
        this.bus.onceType$('ConfigLoaded').subscribe(e => {
            //load workspaces
            let workspace: WorkspaceConfig | undefined = undefined;
            if(workspace === undefined) {
                const nodeLeft: TerminalConfig = {};
                const nodeRight: TerminalConfig = {};
                const parent: SplitNode = {
                    splitDirection: 'vertical',
                    ratio: 0.5,
                    leftChild: nodeLeft,
                    rightChild: nodeRight,
                }
                const pane: GridConfig = {tabId: IdCreator.newTabId(), pane: {}};
                workspace = {grids: [pane]};
            } else {
                //restore workspace
            }
            this.bus.publish({type: 'WorkspaceLoaded', payload: workspace});
        });
        conf.config$.pipe(takeUntilDestroyed(ref)).subscribe((config) => {
           //if (config...) {
            sideMenuService.addMenuItem({
                label: 'Workspace',
                icon: 'mdiViewDashboard',
                component: WorkspaceSideComponent
            });
           //}
        });
    }
}
