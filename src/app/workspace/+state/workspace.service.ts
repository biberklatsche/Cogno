import {DestroyRef, Injectable} from "@angular/core";
import {AppBus} from "../../app-bus/app-bus";
import {IdCreator} from "../../common/id-creator/id-creator";
import {TerminalConfig, GridConfig, SplitNode, WorkspaceConfig, TabConfig} from "../+model/workspace";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ConfigService} from "../../config/+state/config.service";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {WorkspaceSideComponent} from "../workspace-side/workspace-side.component";
import {GridListService} from "../../grid-list/+state/grid-list.service";
import {TabListService} from "../../tab-list/+state/tab-list.service";

@Injectable({providedIn: 'root'})
export class WorkspaceService {

    constructor(private bus: AppBus, conf: ConfigService, sideMenuService: SideMenuService, gridListService: GridListService, tabListService: TabListService, ref: DestroyRef) {
        this.bus.onceType$('ConfigLoaded').subscribe(e => {
            //load workspaces here

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
                const tabId = IdCreator.newTabId();
                const pane: GridConfig = {tabId: tabId, pane: parent};
                const tab: TabConfig = {tabId: tabId }
                workspace = {grids: [pane], tabs: [tab]};

                gridListService.restoreGrids(workspace.grids);
                tabListService.restoreTabs(workspace.tabs);
                setTimeout(() => {
                    const activeTab = workspace!.tabs.find(s => s.isActive);
                    if(activeTab) {
                        tabListService.selectTab(activeTab.tabId);
                    } else {
                        tabListService.selectTab(workspace!.tabs[0].tabId);
                    }
                }, 500);
            } else {
                //restore workspace
            }

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
