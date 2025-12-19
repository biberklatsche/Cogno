import {DestroyRef, Injectable, signal, WritableSignal} from "@angular/core";
import {AppBus} from "../../app-bus/app-bus";
import {IdCreator} from "../../common/id-creator/id-creator";
import {GridConfig, WorkspaceConfig, TabConfig} from "../+model/workspace";
import {ConfigService} from "../../config/+state/config.service";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {GridListService} from "../../grid-list/+state/grid-list.service";
import {TabListService} from "../../tab-list/+state/tab-list.service";
import {SideMenuItemService} from "../../menu/side-menu/+state/side-menu-item.service";
import {ConfigTypes, FeatureMode} from "../../config/+models/config.types";
import {WorkspaceSideComponent} from "../workspace-side/workspace-side.component";

export type WorkspaceConfigUi = WorkspaceConfig & { isSelected?: boolean };

@Injectable({providedIn: 'root'})
export class WorkspaceService extends SideMenuItemService {


    _workspaceList: WritableSignal<WorkspaceConfigUi[]> = signal([]);
    readonly workspaceList = this._workspaceList.asReadonly();

    constructor(bus: AppBus, config: ConfigService, sideMenuService: SideMenuService, gridListService: GridListService, tabListService: TabListService, ref: DestroyRef) {
        super(sideMenuService, bus, config, ref, {
            label: 'Workspace',
            hidden: false,
            icon: 'mdiViewDashboard',
            component: WorkspaceSideComponent,
            actionName: 'open_workspace',
        }, (config: ConfigTypes) => config.workspace?.mode
        );

        this.bus.onceType$('ConfigLoaded').subscribe(e => {
            //load workspaces here

            const tabId = IdCreator.newTabId();
            const pane: GridConfig = {tabId: tabId, pane: {}};
            const tab: TabConfig = {tabId: tabId}
            const defaultWorkspace: WorkspaceConfigUi = {name: 'Default Workspace', color: 'grey', grids: [pane], tabs: [tab], isSelected: true}
            const testWorkspace: WorkspaceConfigUi = {name: 'Test Workspace', color: 'green', grids: [pane], tabs: [tab]}
            const workspaces: WorkspaceConfigUi[] = [defaultWorkspace, testWorkspace];

            this._workspaceList.set(workspaces);

            const restoreWorkspace = workspaces[0];

            gridListService.restoreGrids(restoreWorkspace.grids);
            tabListService.restoreTabs(restoreWorkspace.tabs);
            const activeTab = restoreWorkspace!.tabs.find(s => s.isActive);
            if (activeTab) {
                tabListService.selectTab(activeTab.tabId);
            } else {
                tabListService.selectTab(restoreWorkspace!.tabs[0].tabId);
           }

        });
    }

    protected override onConfigChanged(featureMode: FeatureMode): void {

    }
    protected override onViewChanged(visible: boolean): void {

    }

}
