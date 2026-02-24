import {DestroyRef, Injectable} from "@angular/core";
import {BehaviorSubject, map, Observable} from "rxjs";
import {Grid, GridList, Pane, SplitDirection, TerminalId} from "../+model/model";
import {AppBus} from "../../app-bus/app-bus";
import {PaneConfig, GridConfig, TabId} from "../../workspace/+model/workspace";
import {BinaryNode, BinaryTree} from "../../common/tree/binary-tree";
import {IdCreator} from "../../common/id-creator/id-creator";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TabAddedEvent, TabRemovedEvent, TabSelectedEvent} from "../../tab-list/+bus/events";
import {TerminalComponentFactory} from "./terminal-component.factory";
import {TerminalFocusedEvent} from "../../terminal/+state/handler/focus.handler";
import {
    FocusActiveTerminalAction,
    MaximizePaneAction,
    MinimizePaneAction,
    SelectNextPaneAction,
    SelectPreviousPaneAction
} from "../+bus/actions";
import {TerminalCwdChangedEvent, TerminalTitleChangedEvent} from "../../terminal/+bus/events";


@Injectable({providedIn: 'root'})
export class GridListService {

    private _gridList: BehaviorSubject<GridList> = new BehaviorSubject<GridList>({});
    private _maximizedTerminalId: BehaviorSubject<TerminalId | undefined> = new BehaviorSubject<TerminalId | undefined>(undefined);
    private paneSwapDragSourceTerminalId: TerminalId | undefined;
    private paneSwapDragTargetTerminalId: TerminalId | undefined;
    get grids$(): Observable<Grid[]> {
        return this._gridList.pipe(map(g => Object.values(g)));
    }
    private _activeTabId: BehaviorSubject<TabId | undefined> = new BehaviorSubject<TabId | undefined>(undefined);
    get activeTabId$(): Observable<TabId | undefined> {
        return this._activeTabId.asObservable();
    }
    get maximizedTerminalId$(): Observable<TerminalId | undefined> {
        return this._maximizedTerminalId.asObservable();
    }

    get activeGridIsSplit$(): Observable<boolean> {
        return this._gridList.pipe(
            map(gridList => {
                if (!this._activeTabId.value) return false;
                const grid = gridList[this._activeTabId.value];
                return grid ? !grid.tree.root.isLeaf : false;
            })
        );
    }

    constructor(
        private bus: AppBus,
        private componentFactory: TerminalComponentFactory,
        destroyRef: DestroyRef
    ) {
        this.bus.onType$('TabRemoved').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabRemovedEvent) => {
            this.removeGrid(event.payload);
        });

        this.bus.onType$('TabAdded').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabAddedEvent) => {
            this.restoreGrid({tabId: event.payload!.tabId, pane: {workingDir: event.payload!.workingDir, shellName: event.payload!.shellName}});
            if(event.payload!.isActive) {
                this.selectGrid(event.payload!.tabId);
            }
        });

        this.bus.onType$('TabSelected').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabSelectedEvent) => {
            this.selectGrid(event.payload);
        });

        this.bus.onType$('TerminalTitleChanged').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TerminalTitleChangedEvent) => {
            const gridList = this._gridList.value;
            let tabId = this.determineTabId(gridList, event.payload?.terminalId);
            if(!tabId || !event.payload?.title) return;
            this.bus.publish({path: ['app', 'terminal'], type: "TabTitleChanged", payload: {tabId, title: event.payload.title}});
        });

        this.bus.onType$('TerminalCwdChanged').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TerminalCwdChangedEvent) => {

            const gridList = this._gridList.value;
            let tabId = this.determineTabId(gridList, event.payload?.terminalId);
            if(!tabId || !event.payload?.cwd) return;
            const node = gridList[tabId].tree.first(s => s.isLeaf && s.data?.terminalId === event.payload?.terminalId);
            if(!node?.data) return;
            // Immutable update der Pane
            node.data = {...node.data, workingDir: event.payload.cwd};
            this._gridList.next({...gridList});
            this.bus.publish({path: ['app', 'terminal'], type: "TabTitleChanged", payload: {tabId, title: event.payload.cwd}});
        });

        this.bus.onType$('FocusActiveTerminal').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: FocusActiveTerminalAction) => {
            const focusedTerminalId = this.getFocusedTerminalId();
            if(!focusedTerminalId) return;
            this.bus.publish({path: ['app', 'terminal'], type: "FocusTerminal", payload: focusedTerminalId});
        });

        this.bus.onType$('TerminalFocused').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TerminalFocusedEvent) => {
            if(!this._activeTabId.value) throw new Error("No active tab id found.");
            const gridList = this._gridList.value;
            const focusedTabId = this.determineTabId(gridList, event.payload);
            if (!focusedTabId || focusedTabId !== this._activeTabId.value) return;
            Object.values(gridList).forEach((grid: Grid) => {
               const currentFocusedTab = grid.tree.first(s => (s.isLeaf && s.data?.isFocused) ?? false)
               if(currentFocusedTab && currentFocusedTab.data) currentFocusedTab.data.isFocused = false;
            });
            const paneConfig = gridList[this._activeTabId.value].tree.first(s => s.isLeaf && s.data?.terminalId === event.payload)?.data;
            if(!paneConfig) return;
            paneConfig.isFocused = true;
            this._gridList.next(gridList);
        });

        this.bus.onType$('RemovePane').pipe(takeUntilDestroyed(destroyRef)).subscribe((event) => {
            event.propagationStopped = true;
            const terminalId: TerminalId = event.payload!;
            this.removePane(terminalId);
        });

        this.bus.onType$('SplitPaneRight').pipe(takeUntilDestroyed(destroyRef)).subscribe((event) => {
            this.split(event.payload!,'vertical', 'r');
            event.propagationStopped = true;
        });

        this.bus.onType$('SplitPaneLeft').pipe(takeUntilDestroyed(destroyRef)).subscribe((event) => {
            this.split(event.payload!,'vertical', 'l');
            event.propagationStopped = true;
        });

        this.bus.onType$('SplitPaneDown').pipe(takeUntilDestroyed(destroyRef)).subscribe((event) => {
            this.split(event.payload!,'horizontal', 'r');
            event.propagationStopped = true;
        });

        this.bus.onType$('SplitPaneUp').pipe(takeUntilDestroyed(destroyRef)).subscribe((event) => {
            this.split(event.payload!,'horizontal', 'l');
            event.propagationStopped = true;
        });

        this.bus.onType$('SelectNextPane').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: SelectNextPaneAction) => {
            if (!event.payload) return;
            this.focusAdjacentPane(event.payload, 1);
            event.propagationStopped = true;
        });

        this.bus.onType$('SelectPreviousPane').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: SelectPreviousPaneAction) => {
            if (!event.payload) return;
            this.focusAdjacentPane(event.payload, -1);
            event.propagationStopped = true;
        });

        this.bus.onType$('MaximizePane').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: MaximizePaneAction) => {
            if (!event.payload) return;
            this.togglePaneMaximize(event.payload);
            event.propagationStopped = true;
        });

        this.bus.onType$('MinimizePane').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: MinimizePaneAction) => {
            if (event.payload && this._maximizedTerminalId.value !== event.payload) return;
            this.minimizePane();
            event.propagationStopped = true;
        });
    }

    removePane(terminalId: TerminalId) {
        const gridList = this._gridList.value;
        let gridAndNode = this.determineGrid(gridList, terminalId);
        if (!gridAndNode) return;
        if (this._maximizedTerminalId.value === terminalId) {
            this.minimizePane();
        }
        if(gridAndNode.node.isRoot) {
            this.bus.publish({path: ['app', 'terminal'], type: "RemoveTab", payload: gridAndNode.grid.tabId});
        } else {
            const wasFocusedNode = gridAndNode.node.data?.isFocused;
            const newChild = gridAndNode.grid.tree.remove(gridAndNode.node.key);
            if(wasFocusedNode) {
                setTimeout(() => this.bus.publish({path: ['app', 'terminal'], type: "FocusTerminal", payload: newChild?.data?.terminalId}), 250);
            }
        }
        this.componentFactory.destroy(terminalId);
        this._gridList.next(gridList);
    }

    startPaneSwapDrag(sourceTerminalId: TerminalId): void {
        this.paneSwapDragSourceTerminalId = sourceTerminalId;
        this.paneSwapDragTargetTerminalId = sourceTerminalId;
    }

    updatePaneSwapTarget(targetTerminalId: TerminalId): void {
        if (!this.paneSwapDragSourceTerminalId) return;
        this.paneSwapDragTargetTerminalId = targetTerminalId;
    }

    finishPaneSwapDrag(): void {
        if (!this.paneSwapDragSourceTerminalId || !this.paneSwapDragTargetTerminalId) {
            this.cancelPaneSwapDrag();
            return;
        }
        this.swapPanes(this.paneSwapDragSourceTerminalId, this.paneSwapDragTargetTerminalId);
        this.cancelPaneSwapDrag();
    }

    cancelPaneSwapDrag(): void {
        this.paneSwapDragSourceTerminalId = undefined;
        this.paneSwapDragTargetTerminalId = undefined;
    }

    isPaneSwapDragActive(): boolean {
        return this.paneSwapDragSourceTerminalId !== undefined;
    }

    movePaneSwapSourceToNewTab(): void {
        if (!this.paneSwapDragSourceTerminalId) {
            this.cancelPaneSwapDrag();
            return;
        }

        const sourceTerminalId = this.paneSwapDragSourceTerminalId;
        const gridList = this._gridList.value;
        if (this._maximizedTerminalId.value === sourceTerminalId) {
            this.minimizePane();
        }
        const sourceGridAndNode = this.determineGrid(gridList, sourceTerminalId);
        if (!sourceGridAndNode || sourceGridAndNode.node.isRoot || !sourceGridAndNode.node.data) {
            this.cancelPaneSwapDrag();
            return;
        }

        const sourcePaneData: Pane = {...sourceGridAndNode.node.data, isFocused: true};
        const promotedNode = sourceGridAndNode.grid.tree.remove(sourceGridAndNode.node.key);
        if (promotedNode?.data) {
            promotedNode.data = {...promotedNode.data, isFocused: false};
        }

        const newTabId = IdCreator.newTabId();
        const movedPaneRootNode = new BinaryNode<Pane>({...sourcePaneData});
        gridList[newTabId] = {tabId: newTabId, tree: new BinaryTree<Pane>(movedPaneRootNode)};
        this._gridList.next({...gridList});

        this.bus.publish({
            type: 'CreateTab',
            payload: {tabId: newTabId, title: sourcePaneData.workingDir ?? 'Shell', isActive: true}
        });

        this.cancelPaneSwapDrag();
    }

    swapPanes(sourceTerminalId: TerminalId, targetTerminalId: TerminalId): void {
        if (sourceTerminalId === targetTerminalId) return;
        const gridList = this._gridList.value;
        const sourceGridAndNode = this.determineGrid(gridList, sourceTerminalId);
        const targetGridAndNode = this.determineGrid(gridList, targetTerminalId);
        if (!sourceGridAndNode || !targetGridAndNode) return;
        if (sourceGridAndNode.grid.tabId !== targetGridAndNode.grid.tabId) return;

        const sourcePane = sourceGridAndNode.node.data;
        const targetPane = targetGridAndNode.node.data;
        if (!sourcePane || !targetPane) return;

        sourceGridAndNode.node.data = targetPane;
        targetGridAndNode.node.data = sourcePane;
        this._gridList.next({...gridList});
    }

    private split(terminalId: TerminalId, splitDirection: SplitDirection, side: 'l' | 'r') {
        if (!this._activeTabId.value) throw new Error("No active tab id found.");
        const gridList = this._gridList.value;
        const tree = gridList[this._activeTabId.value].tree;
        const node = tree.first(s => (s.isLeaf && s.data?.terminalId === terminalId));
        if (!node) throw new Error("No focused pane found.");
        const paneParent: Pane = {
            splitDirection: splitDirection,
            ratio: 0.5
        };
        this.bus.publish({path: ['app', 'terminal'], type: "BlurTerminal", payload: node.data?.terminalId!});

        const paneChild: Pane = {terminalId: IdCreator.newTerminalId()};
        tree.add(node.key, side, paneParent, paneChild);
        this._gridList.next(gridList);
    }

    restoreGrids(gridConfigList: GridConfig[]) {
        for(const tabId in this._gridList.value) {
            this.removeGrid(tabId);
        }
        for (let grid of gridConfigList) {
            this.restoreGrid(grid);
        }
    }

    getGridConfigs(): GridConfig[] {
        const result: GridConfig[] = [];
        const gridList = this._gridList.value;
        for (const grid of Object.values(gridList)) {
            result.push({
                tabId: grid.tabId,
                pane: this.serializeNode(grid.tree.root)
            });
        }
        return result;
    }

    restoreGrid(gridConfig: GridConfig) {
        const gridList = this._gridList.value;
        if(gridList[gridConfig.tabId]) return;
        gridList[gridConfig.tabId] = {tabId: gridConfig.tabId, tree: this.createTree(gridConfig)};
        this._gridList.next(gridList);
    }

    private createTree(paneConfig: GridConfig): BinaryTree<Pane> {
        const rootNode: BinaryNode<Pane> = new BinaryNode();
        this.addNode(rootNode, paneConfig.pane);
        return new BinaryTree(rootNode);
    }

    private addNode(parent: BinaryNode<Pane>, nodeConfig: PaneConfig) {
        if(nodeConfig.splitDirection){
            parent.data = {splitDirection: nodeConfig.splitDirection, ratio: nodeConfig.ratio};
            const leftChild: BinaryNode<Pane> = new BinaryNode();
            const rightChild: BinaryNode<Pane> = new BinaryNode();
            parent.addToNode(leftChild, 'l');
            parent.addToNode(rightChild, 'r');
            this.addNode(leftChild, nodeConfig.leftChild)
            this.addNode(rightChild, nodeConfig.rightChild)
        } else {
            parent.data = {shellName: nodeConfig.shellName, workingDir: nodeConfig.workingDir, terminalId: IdCreator.newTerminalId()};
        }
    }

    private serializeNode(node: BinaryNode<Pane>): PaneConfig {
        // Leaf node -> TerminalConfig
        if (node.isLeaf) {
            return {
                shellName: node.data?.shellName,
                workingDir: node.data?.workingDir
            };
        }
        // Split node
        return {
            splitDirection: node.data?.splitDirection!,
            ratio: node.data?.ratio!,
            leftChild: this.serializeNode(node.left!),
            rightChild: this.serializeNode(node.right!)
        };
    }

    removeGrid(tab?: TabId) {
        if(tab === undefined) return;
        const gridList = this._gridList.value;
        const grid = gridList[tab];
        const terminalIds = grid.tree.find(s => s.isLeaf).map(s => s.data?.terminalId);
        delete gridList[tab];
        for (let terminalId of terminalIds) {
            this.componentFactory.destroy(terminalId);
        }
        this._gridList.next(gridList);
    }

    selectGrid(tab?: TabId) {
        if(tab === undefined) return;
        this.minimizePane();
        this._activeTabId.next(tab);
        const grid = this._gridList.value[tab];
        const terminalId = this.getFirstTerminalId(grid.tree.root);
        // Defer focus to the next task to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => this.bus.publish({path: ['app', 'terminal'], type: 'FocusTerminal', payload: terminalId}));
    }

    getFirstTerminalId(node: BinaryNode<Pane>): TerminalId {
        if(node.isLeaf) return  node.data!.terminalId!;
        return this.getFirstTerminalId(node.left!);
    }

    getFocusedTerminalId(): TerminalId | undefined {
        const activeGrid = this.getActiveGrid();
        if(!activeGrid) return;
        const focusedNode = activeGrid.tree.first(s => (s.isLeaf && s.data?.isFocused) ?? false);
        if(!focusedNode) return;
        return focusedNode.data!.terminalId!;
    }

    focusActiveTerminal(): void {
        this.bus.publish({type: 'FocusActiveTerminal', path: ['app', 'grid']});
    }

    private focusAdjacentPane(terminalId: TerminalId, direction: 1 | -1): void {
        const activeGrid = this.getActiveGrid();
        if (!activeGrid) return;

        const terminals = activeGrid.tree
            .find(node => node.isLeaf && !!node.data?.terminalId)
            .map(node => node.data!.terminalId!);
        if (terminals.length < 2) return;

        const currentIndex = terminals.indexOf(terminalId);
        if (currentIndex < 0) return;

        const nextIndex = (currentIndex + direction + terminals.length) % terminals.length;
        this.bus.publish({type: 'FocusTerminal', payload: terminals[nextIndex], path: ['app', 'terminal']});
    }

    private maximizePane(terminalId: TerminalId): void {
        this._maximizedTerminalId.next(terminalId);
        this.bus.publish({type: 'PaneMaximizedChanged', payload: {terminalId}});
    }

    private togglePaneMaximize(terminalId: TerminalId): void {
        if (this._maximizedTerminalId.value === terminalId) {
            this.minimizePane();
            return;
        }
        this.maximizePane(terminalId);
    }

    private minimizePane(): void {
        if (!this._maximizedTerminalId.value) return;
        this._maximizedTerminalId.next(undefined);
        this.bus.publish({type: 'PaneMaximizedChanged', payload: {terminalId: undefined}});
    }

    private getActiveGrid(): Grid | undefined {
        if(!this._activeTabId.value) return;
        return this._gridList.value[this._activeTabId.value];
    }

    private determineGrid(gridList: GridList, terminalId?: TerminalId): {grid: Grid, node: BinaryNode<Pane> }| undefined {
        if(!terminalId) return;
        for (const grid of Object.values(gridList)) {
            const node = grid.tree.first(p => p.data!.terminalId === terminalId);
            if(node && node.isLeaf) {
                return {grid, node};
            }
        }
        return;
    }

    private determineTabId(gridList: GridList, terminalId: TerminalId | undefined): TabId | undefined {
        if(!terminalId) return;
        for (const grid of Object.values(gridList)) {
            const node = grid.tree.first(p => p.data!.terminalId === terminalId);
            if(node && node.isLeaf) {
                return grid.tabId;
            }
        }
        return;
    }
}
