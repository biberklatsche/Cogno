import {DestroyRef, Injectable} from "@angular/core";
import {AppBus} from "../../app-bus/app-bus";
import {IdCreator} from "../../common/id-creator/id-creator";
import {TerminalConfig, GridConfig, SplitNode, WorkspaceConfig, TabConfig} from "../+model/workspace";
import {ConfigService} from "../../config/+state/config.service";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {WorkspaceSideComponent} from "../workspace-side/workspace-side.component";
import {GridListService} from "../../grid-list/+state/grid-list.service";
import {TabListService} from "../../tab-list/+state/tab-list.service";
import {SideMenuItemService} from "../../menu/side-menu/+state/side-menu-item.service";

@Injectable({providedIn: 'root'})
export class WorkspaceService extends SideMenuItemService {

    constructor(bus: AppBus, config: ConfigService, sideMenuService: SideMenuService, gridListService: GridListService, tabListService: TabListService, ref: DestroyRef) {
        super(sideMenuService, bus, config, ref, {
            label: 'Workspace',
            hidden: false,
            icon: 'mdiViewDashboard',
            component: WorkspaceSideComponent,
            actionName: 'toggle_workspace'
        });

        this.bus.onceType$('ConfigLoaded').subscribe(e => {
            //load workspaces here
            let workspace: WorkspaceConfig | undefined = undefined;
            if (workspace === undefined) {
                const nodeLeft: TerminalConfig = {};
                const nodeRight: TerminalConfig = {};
                const parent: SplitNode = {
                    splitDirection: 'vertical',
                    ratio: 0.5,
                    leftChild: nodeLeft,
                    rightChild: nodeRight,
                }
                const tabId = IdCreator.newTabId();
                const pane: GridConfig = {tabId: tabId, pane: {}};
                const tab: TabConfig = {tabId: tabId}
                workspace = {grids: [pane], tabs: [tab]};

                gridListService.restoreGrids(workspace.grids);
                tabListService.restoreTabs(workspace.tabs);
                const activeTab = workspace!.tabs.find(s => s.isActive);
                if (activeTab) {
                    tabListService.selectTab(activeTab.tabId);
                } else {
                    tabListService.selectTab(workspace!.tabs[0].tabId);
                }
            } else {
                //restore workspace
            }

        });
    }

    dispose() {}
}
