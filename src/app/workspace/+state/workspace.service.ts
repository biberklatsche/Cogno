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
import {KeybindService} from "../../keybinding/keybind.service";
import {Grid} from "../../common/grid/grid-calculations";
import {WorkspaceRepository} from "./workspace.repository";

export type WorkspaceConfigUi = WorkspaceConfig & { isSelected: boolean };

@Injectable({providedIn: 'root'})
export class WorkspaceService extends SideMenuItemService {

    private readonly DEFAULT_WORKSPACE: WorkspaceConfig = {id: "WS_DEFAULT", name: 'Default Workspace', color: 'grey', grids: [{tabId: "TB_DEFAULT", pane: {}}], tabs: [{tabId: "TB_DEFAULT"}]};
    _workspaceList: WritableSignal<WorkspaceConfigUi[]> = signal([]);
    readonly workspaceList = this._workspaceList.asReadonly();

    // inline edit state moved to service
    editWorkspaceId: WritableSignal<string | undefined> = signal<string | undefined>(undefined);
    editWorkspaceName: WritableSignal<string> = signal('');

    constructor(
        bus: AppBus,
        config: ConfigService,
        sideMenuService: SideMenuService,
        ref: DestroyRef,
        private keybinds: KeybindService,
        private workspaceRepository: WorkspaceRepository,
        private gridListService: GridListService,
        private tabListService: TabListService) {
        super(sideMenuService, bus, config, ref, {
            label: 'Workspace',
            hidden: false,
            pinned: false,
            icon: 'mdiViewDashboard',
            component: WorkspaceSideComponent,
            actionName: 'open_workspace',
        }, (config: ConfigTypes) => config.workspace?.mode
        );

        this.bus.onceType$('DBInitialized').subscribe(async e => {
            //load workspaces here
            const workspaces = await workspaceRepository.getAllWorkspaces();


            /*const tabId = IdCreator.newTabId();
            const workspaceId = IdCreator.newWorkspaceId();
            const pane: GridConfig = {tabId: tabId, pane: {}};
            const tab: TabConfig = {tabId: tabId}
            const testWorkspace: WorkspaceConfigUi = {id: workspaceId, name: 'Test Workspace', color: 'green', grids: [pane], tabs: [tab]}*/

            const workspacesUi: WorkspaceConfigUi[] = [this.DEFAULT_WORKSPACE, ...workspaces].map(w => ({...w, isSelected: w.isActive ?? false}));
            if(!workspacesUi.find(s => s.isSelected)) {
                workspacesUi[0].isSelected = true;
                workspacesUi[0].isActive = true;
            }
            this._workspaceList.set(workspacesUi);

            let defaultWorkspace = workspacesUi.find(w => w.isActive)!;

            this.restoreWorkspace(defaultWorkspace);

        });
    }

    protected override onConfigChange(featureMode: FeatureMode): void {
        if(featureMode === 'off') {
            this.onClose();
        }
    }

    protected override onOpen(): void {
        this.registerKeybindListener();
    }

    protected override onClose(): void {
        this.unregisterKeybindListener();
    }

    private registerKeybindListener(): void {
        this.keybinds.registerListener(
            'workspace',
            ['Enter', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'],
            evt => this.handleKey(evt)
        );
    }

    private unregisterKeybindListener(): void {
        this.keybinds.unregisterListener('workspace');
    }

    private handleKey(event: KeyboardEvent): void {
        // When inline rename is active, handle Enter/Escape for rename only
        const key = event.key;
        if (this.editWorkspaceId() !== undefined) {
            switch (key) {
                case 'Escape':
                    this.closeEdit();
                    break;
                case 'Enter':
                    this.confirmEdit();
                    break;
            }
        } else {
            switch (key) {
                case 'Escape':
                    this.sideMenuService.close();
                    break;
                case 'Enter':
                    this.restoreSelectedWorkspace();
                    this.sideMenuService.close();
                    break;
                case 'ArrowDown':
                    this.selectNextWorkspace('d');
                    break;
                case 'ArrowUp':
                    this.selectNextWorkspace('u');
                    break;
                case 'ArrowLeft':
                    this.selectNextWorkspace('l');
                    break;
                case 'ArrowRight':
                    this.selectNextWorkspace('r');
                    break;
            }
        }
    }

    private selectNextWorkspace(direction: 'l' | 'r' | 'u' | 'd'): void {
        const workspaceList = [...this._workspaceList()];
        if (workspaceList.length === 0) return;
        const current = workspaceList.findIndex(c => c.isSelected);
        const next = Grid.nextIndex(current, direction, 2, workspaceList.length);
        workspaceList.forEach(c => (c.isSelected = false));
        workspaceList[next].isSelected = true;
        this._workspaceList.set(workspaceList);
    }

    private restoreSelectedWorkspace() {
        const selectedWorkspace = this._workspaceList().find(s => s.isSelected);
        if(!selectedWorkspace) throw new Error('No workspace selected');
        this.restoreWorkspace(selectedWorkspace);
    }

    public restoreWorkspace(workspace: WorkspaceConfigUi) {
        const workspaceList = [...this._workspaceList()];
        for(const workspace of workspaceList) workspace.isActive = false;
        workspace.isActive = true;
        this.gridListService.restoreGrids(workspace.grids);
        this.tabListService.restoreTabs(workspace.tabs);
        const activeTab = workspace!.tabs.find(s => s.isActive);
        if (activeTab) {
            this.tabListService.selectTab(activeTab.tabId);
        } else {
            this.tabListService.selectTab(workspace!.tabs[0].tabId);
        }
        this._workspaceList.set(workspaceList);
    }

    addWorkspace() {
        const tabId = IdCreator.newTabId();
        const pane: GridConfig = {tabId: tabId, pane: {}};
        const tab: TabConfig = {tabId: tabId}
        const testWorkspace: WorkspaceConfigUi = {id: '', name: '', color: 'green', grids: [pane], tabs: [tab], isSelected: true, isActive: true};
        const workspaceList = [...this._workspaceList()];
        for(const workspace of workspaceList) {
            workspace.isActive = false;
            workspace.isSelected = false;
        }
        workspaceList.push(testWorkspace);
        this.editWorkspaceId.set(testWorkspace.id);
        this.editWorkspaceName.set('');
        this._workspaceList.set(workspaceList);
    }

    private async renameWorkspace(id: string, newName: string): Promise<void> {
        const list = [...this._workspaceList()];
        const idx = list.findIndex(w => w.id === id);
        if (idx === -1) throw new Error('Workspace id not found');
        const current = { ...list[idx], name: newName };
        current.id = await this.saveWorkspace(current);
        // update UI state
        list[idx] = current;
        this._workspaceList.set(list);
    }

    private async saveWorkspace(workspace: WorkspaceConfig): Promise<string> {
        const isNew = workspace.id === '';
        if (isNew) {
            workspace.id = IdCreator.newWorkspaceId();
        }
        // Load current configurations from services
        workspace.grids = this.gridListService.getGridConfigs();
        workspace.tabs = this.tabListService.getTabConfigs();
        console.log('###### saving workspace', workspace);
        if (isNew) {
            await this.workspaceRepository.createWorkspace(workspace);
        } else {
            await this.workspaceRepository.updateWorkspace(workspace);
        }
        return workspace.id;
    }

    async deleteWorkspace(id: string): Promise<void> {
        const list = [...this._workspaceList()];
        const idx = list.findIndex(w => w.id === id);
        if (idx === -1) throw new Error('Workspace id not found');
        const wasActive = list[idx].isActive;
        await this.workspaceRepository.deleteWorkspace(id);
        list.splice(idx, 1);
        // clear inline edit state if deleted item was being edited
        if (this.editWorkspaceId() === id) {
            this.closeEdit();
        }
        // adjust selection/active
        if (list.length > 0) {
            if (!list.find(w => w.isSelected)) {
                list[0].isSelected = true;
            }
            if (wasActive && !list.find(w => w.isActive)) {
                list[0].isActive = true;
                // restore the newly active workspace
                this.restoreWorkspace(list[0]);
            }
        }
        this._workspaceList.set(list);
    }

    // Inline rename API
    startEdit(id: string, currentName: string | undefined | null): void {
        this.editWorkspaceId.set(id);
        this.editWorkspaceName.set((currentName ?? ''));
        this.keybinds.unregisterListener('workspace')
    }

    setWorkspaceName(event: Event): void {
        const value = (event.target as HTMLInputElement).value
        this.editWorkspaceName.set(value ?? '');
    }

    confirmEdit(): void {
        let id = this.editWorkspaceId();
        const newName = this.editWorkspaceName().trim();
        if (id === undefined || newName.length === 0) {
            this.closeEdit();
            return;
        }
        const workspace = this._workspaceList().find(w => w.id === id);
        if (workspace && newName && newName !== workspace.name) {
            // Fire and forget async rename; UI state will be updated when promise resolves
            void this.renameWorkspace(id, newName);
        }
        this.closeEdit();
    }

    closeEdit(): void {
        this.editWorkspaceId.set(undefined);
        this.editWorkspaceName.set('');
        this.registerKeybindListener();
    }
}
