import {DestroyRef, Injectable} from "@angular/core";
import {BehaviorSubject, map, Observable, Subject} from "rxjs";
import {Grid, GridList, Pane, TerminalId} from "../+model/model";
import {AppBus} from "../../app-bus/app-bus";
import {WorkspaceLoadedEvent} from "../../workspace/+bus/events";
import {PaneConfig, GridConfig, TabId} from "../../workspace/+model/workspace";
import {BinaryNode, BinaryTree} from "../../common/tree/binary-tree";
import {IdCreator} from "../../common/id-creator/id-creator";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TabAddedEvent, TabRemovedEvent, TabSelectedEvent} from "../../tab-list/+bus/events";


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

    constructor(private bus: AppBus, destroyRef: DestroyRef) {
        this.bus.onType$('WorkspaceLoaded').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: WorkspaceLoadedEvent) => {
            for(const tapId in this._gridList.value) {
                this.removeGrid(tapId);
            }
            for (let grid of event.payload!.grids) {
                this.addGrid(grid);
            }
            this._activeTabId.next(event.payload!.grids[0].tabId);
        });

        this.bus.onType$('TabRemovedEvent').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabRemovedEvent) => {
            this.removeGrid(event.payload);
        });

        this.bus.onType$('TabAddedEvent').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabAddedEvent) => {
            this.addGrid({tabId: event.payload!.tabId, pane: {workingDir: event.payload!.workingDir, shellConfigPosition: event.payload!.shellConfigPosition ?? 1}});
            this.selectGrid(event.payload!.tabId);
        });

        this.bus.onType$('TabSelectedEvent').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabSelectedEvent) => {
            this.selectGrid(event.payload);
        });
    }

    addGrid(gridConfig: GridConfig) {
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
        delete gridList[tab];
        this._gridList.next(gridList);
    }

    selectGrid(tab?: TabId) {
        if(tab === undefined) return;
        this._activeTabId.next(tab);
        const grid = this._gridList.value[tab];
        const terminalId = this.getFirstTerminalId(grid.tree.root);
        this.bus.publish({type: 'FocusTerminalCommand'});
    }

    getFirstTerminalId(node: BinaryNode<Pane>): TerminalId {
        if(node.isLeaf) return  node.data!.terminalId!;
        return this.getFirstTerminalId(node.left!);
    }
}
