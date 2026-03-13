import {DestroyRef, Injectable, signal, WritableSignal} from "@angular/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import { GridConfig, TabConfig } from "@cogno/core-sdk";
import { WorkspaceConfiguration } from "@cogno/base-features/side-menu/workspace/workspace.model";
import { WorkspaceRepository } from "@cogno/base-features/side-menu/workspace/workspace.repository";
import {AppBus} from "../app-bus/app-bus";
import {IdCreator} from "../common/id-creator/id-creator";
import {SideMenuService} from "../menu/side-menu/+state/side-menu.service";
import {GridListService} from "../grid-list/+state/grid-list.service";
import {TabListService} from "../tab-list/+state/tab-list.service";
import {Color} from "../common/color/color";
import {ActionFired} from "../action/action.models";

export type WorkspaceConfigUi = WorkspaceConfiguration & { isSelected: boolean };

export const DEFAULT_WORKSPACE_ID = "WS-DEFAULT"

@Injectable({providedIn: 'root'})
export class WorkspaceHostApplicationService {

    private readonly DEFAULT_WORKSPACE: WorkspaceConfiguration = {id: DEFAULT_WORKSPACE_ID, name: 'Default Workspace', color: 'grey', grids: [{tabId: "TB_DEFAULT", pane: {}}], tabs: [{tabId: "TB_DEFAULT"}]};

    _workspaceList: WritableSignal<WorkspaceConfigUi[]> = signal([]);
    readonly workspaceList = this._workspaceList.asReadonly();

    constructor(
        private bus: AppBus,
        private sideMenuService: SideMenuService,
        private workspaceRepository: WorkspaceRepository,
        private gridListService: GridListService,
        private tabListService: TabListService,
        destroyRef: DestroyRef,
    ) {
        this.bus.onceType$('DBInitialized').subscribe(async () => {
            //load workspaces here
            const workspaces = await workspaceRepository.getAllWorkspaces();
            const workspacesUi: WorkspaceConfigUi[] = [this.DEFAULT_WORKSPACE, ...workspaces].map(w => ({...w, isSelected: w.isActive ?? false}));
            if(!workspacesUi.find(s => s.isSelected)) {
                workspacesUi[0].isSelected = true;
                workspacesUi[0].isActive = true;
            }
            this._workspaceList.set(workspacesUi);

            let defaultWorkspace = workspacesUi.find(w => w.isActive)!;

            await this.restoreWorkspace(defaultWorkspace);

        });
        this.bus.onType$('TabRenamed')
            .pipe(takeUntilDestroyed(destroyRef))
            .subscribe(async () => {
                const active = this.getActiveWorkspace();
                if (!active || active.id === DEFAULT_WORKSPACE_ID) return;
                await this.saveWorkspace(active);
            });

        // Capture-phase interceptor for close_window and quit to handle autosave without coupling WindowService
        this.bus.on$({ path: ['app'], type: 'ActionFired', phase: 'capture' })
            .pipe(takeUntilDestroyed(destroyRef))
            .subscribe(async (msg) => {
                if (msg.payload !== 'close_window' && msg.payload !== 'quit') return;
                const args = msg.args ?? [];
                // Guard to avoid endless loop when we re-publish
                if (args.includes('workspace_saved')) return;

                const active = this.getActiveWorkspace();
                if (active?.autosave) {
                    await this.saveWorkspace(active);
                }
                msg.propagationStopped = true;
                this.bus.publish(ActionFired.create(msg.payload, msg.trigger, [...args, 'workspace_saved']));
            });
    }

    public async restoreWorkspace(workspace: WorkspaceConfigUi) {
        const workspaceList = [...this._workspaceList()];

        // Detect previous active workspace and autosave if needed
        const prevActive = workspaceList.find(w => w.isActive);
        if (prevActive && prevActive.id !== workspace.id && prevActive.autosave) {
            await this.saveWorkspace(prevActive);
        }

        for(const ws of workspaceList) {
            ws.isActive = false;
            ws.isSelected = false;
        }
        workspace.isActive = true;
        workspace.isSelected = true;
        this.tabListService.restoreTabs(workspace.tabs);
        this.gridListService.restoreGrids(workspace.grids);
        const activeTab = workspace!.tabs.find(s => s.isActive);
        if (activeTab) {
            this.tabListService.selectTab(activeTab.tabId);
        } else {
            this.tabListService.selectTab(workspace!.tabs[0].tabId);
        }
        this._workspaceList.set(workspaceList);

        // Update badge color - don't show badge for default workspace
        if (workspace.id === DEFAULT_WORKSPACE_ID) {
            this.sideMenuService.updateBadgeColor('Workspace', undefined);
        } else {
            this.sideMenuService.updateBadgeColor('Workspace', workspace.color);
        }
    }

    createWorkspaceDraft(): WorkspaceConfigUi {
        const tabId = IdCreator.newTabId();
        const pane: GridConfig = {tabId: tabId, pane: {}};
        const tab: TabConfig = {tabId: tabId}
        return {id: '', name: '', color: undefined, grids: [pane], tabs: [tab], isSelected: true, isActive: true};
    }

    private async saveWorkspace(workspace: WorkspaceConfiguration): Promise<string> {
        const isNew = workspace.id === '';
        if (isNew) {
            workspace.id = IdCreator.newWorkspaceId();
        }
        // Load current configurations from services
        workspace.grids = this.gridListService.getGridConfigs();
        workspace.tabs = this.tabListService.getTabConfigs();

        if (isNew) {
            await this.workspaceRepository.createWorkspace(workspace);
        } else {
            await this.workspaceRepository.updateWorkspace(workspace);
        }
        return workspace.id;
    }

    // Helpers for autosave scenarios
    private getActiveWorkspace(): WorkspaceConfigUi | undefined {
        return this._workspaceList().find(w => w.isActive);
    }

    // Public API to save a workspace coming from the dialog
    public async save(workspace: WorkspaceConfiguration): Promise<string> {
        // derive color from name if applicable
        if(!workspace.color) workspace.color = Color.fromText(workspace.name);
        const id = await this.saveWorkspace(workspace);
        // update list in memory
        const list = [...this._workspaceList()];
        const idx = list.findIndex(w => w.id === workspace.id || (workspace.id === '' && w.name === workspace.name));
        if (idx >= 0) {
            list[idx] = { ...workspace, isSelected: list[idx].isSelected, isActive: list[idx].isActive } as WorkspaceConfigUi;
        } else {
            // For new workspace, deactivate others and select this one
            for (const ws of list) { ws.isActive = false; ws.isSelected = false; }
            const ui: WorkspaceConfigUi = { ...workspace, id, isSelected: true, isActive: true };
            list.push(ui);
            this.sideMenuService.updateBadgeColor('Workspace', workspace.color);
        }
        this._workspaceList.set(list);
        return id;
    }

    async deleteWorkspace(id: string): Promise<void> {
        const list = [...this._workspaceList()];
        const idx = list.findIndex(w => w.id === id);
        if (idx === -1) throw new Error('Workspace id not found');
        const wasActive = list[idx].isActive;
        await this.workspaceRepository.deleteWorkspace(id);
        list.splice(idx, 1);
        // adjust selection/active
        if (list.length > 0) {
            if (!list.find(w => w.isSelected)) {
                list[0].isSelected = true;
            }
            if (wasActive && !list.find(w => w.isActive)) {
                list[0].isActive = true;
                // restore the newly active workspace
                await this.restoreWorkspace(list[0]);
            }
        }
        this._workspaceList.set(list);
    }

    getWorkspaceById(id: string): WorkspaceConfigUi | undefined {
        return this._workspaceList().find(workspaceConfig => workspaceConfig.id === id);
    }
}
