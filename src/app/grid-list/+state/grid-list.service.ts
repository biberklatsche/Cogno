import {DestroyRef, Injectable} from "@angular/core";
import {BehaviorSubject, map, Observable, Subject} from "rxjs";
import {Grid, GridList, Pane, SplitDirection, TerminalId} from "../+model/model";
import {AppBus} from "../../app-bus/app-bus";
import {WorkspaceLoadedEvent} from "../../workspace/+bus/events";
import {PaneConfig, GridConfig, TabId} from "../../workspace/+model/workspace";
import {BinaryNode, BinaryTree} from "../../common/tree/binary-tree";
import {IdCreator} from "../../common/id-creator/id-creator";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TabAddedEvent, TabRemovedEvent, TabSelectedEvent} from "../../tab-list/+bus/events";
import {TerminalComponentFactory} from "./terminal-component.factory";
import {TerminalFocusedEvent} from "../../terminal/+state/handler/focus.handler";
import {FocusActiveTerminalAction} from "../+bus/actions";


@Injectable({providedIn: 'root'})
export class GridListService {

    private _gridList: BehaviorSubject<GridList> = new BehaviorSubject<GridList>({});
    get grids$(): Observable<Grid[]> {
        return this._gridList.pipe(map(g => Object.values(g)));
    }
    private _activeTabId: BehaviorSubject<TabId | undefined> = new BehaviorSubject<TabId | undefined>(undefined);
    get activeTabId$(): Observable<TabId | undefined> {
        return this._activeTabId.asObservable();
    }

    constructor(private bus: AppBus, private componentFactory: TerminalComponentFactory, destroyRef: DestroyRef) {
        this.bus.onType$('WorkspaceLoaded').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: WorkspaceLoadedEvent) => {
            for(const tapId in this._gridList.value) {
                this.removeGrid(tapId);
            }
            for (let grid of event.payload!.grids) {
                this.restoreGrid(grid);
            }
            this.bus.publish({type: "SelectTab", payload: event.payload!.grids[0].tabId})
        });

        this.bus.onType$('TabRemoved').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabRemovedEvent) => {
            this.removeGrid(event.payload);
        });

        this.bus.onType$('TabAdded').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabAddedEvent) => {
            this.restoreGrid({tabId: event.payload!.tabId, pane: {workingDir: event.payload!.workingDir, shellConfigPosition: event.payload!.shellConfigPosition ?? 1}});
            if(event.payload!.isActive) {
                this.selectGrid(event.payload!.tabId);
            }
        });

        this.bus.onType$('TabSelected').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabSelectedEvent) => {
            this.selectGrid(event.payload);
        });

        this.bus.onType$('FocusActiveTerminal').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: FocusActiveTerminalAction) => {
            const focusedTerminalId = this.getFocusedTerminalId();
            if(!focusedTerminalId) return;
            this.bus.publish({path: ['app', 'terminal'], type: "FocusTerminal", payload: focusedTerminalId});
        });

        this.bus.onType$('TerminalFocused').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TerminalFocusedEvent) => {
            if(!this._activeTabId.value) throw new Error("No active tab id found.");
            const gridList = this._gridList.value;
            Object.values(gridList).forEach((grid: Grid) => {
               const currentFocusedTab = grid.tree.first(s => (s.isLeaf && s.data?.isFocused) ?? false)
               if(currentFocusedTab && currentFocusedTab.data) currentFocusedTab.data.isFocused = false;
            });
            const paneConfig = gridList[this._activeTabId.value].tree.first(s => s.isLeaf && s.data?.terminalId === event.payload)?.data;
            if(!paneConfig) throw new Error("No pane with id found.");
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
    }

    private removePane(terminalId: TerminalId) {
        const gridList = this._gridList.value;
        let gridAndNode = this.determineGridId(gridList, terminalId);
        if (!gridAndNode) return;
        if(gridAndNode.node.isRoot) {
            this.bus.publish({path: ['app', 'terminal'], type: "RemoveTab", payload: gridAndNode.grid.tabId});
        } else {
            const wasFocusedNode = gridAndNode.node.data?.isFocused;
            const newChild = gridAndNode.grid.tree.remove(gridAndNode.node.key);
            if(wasFocusedNode) {
                setTimeout(() => this.bus.publish({path: ['app', 'terminal'], type: "FocusTerminal", payload: newChild?.data?.terminalId}), 250);
            }
        }
        this._gridList.next(gridList);
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

        const paneChild: Pane = {shellConfigPosition: 1, terminalId: IdCreator.newTerminalId()};
        tree.add(node.key, side, paneParent, paneChild);
        this._gridList.next(gridList);
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
            parent.data = {shellConfigPosition: nodeConfig.shellConfigPosition ?? 1, workingDir: nodeConfig.workingDir, terminalId: IdCreator.newTerminalId()};
        }
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
        this._activeTabId.next(tab);
        const grid = this._gridList.value[tab];
        const terminalId = this.getFirstTerminalId(grid.tree.root);
        this.bus.publish({path: ['app', 'terminal'], type: 'FocusTerminal', payload: terminalId});
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

    private getActiveGrid(): Grid | undefined {
        if(!this._activeTabId.value) return;
        return this._gridList.value[this._activeTabId.value];
    }

    private determineGridId(gridList: GridList, terminalId?: TerminalId): {grid: Grid, node: BinaryNode<Pane> }| undefined {
        if(!terminalId) return;
        for (const grid of Object.values(gridList)) {
            const node = grid.tree.first(p => p.data!.terminalId === terminalId);
            if(node && node.isLeaf) {
                return {grid, node};
            }
        }
        return;
    }
}
