import {Injectable} from "@angular/core";
import {BehaviorSubject, map, Observable} from "rxjs";
import {Grid, GridList, Pane} from "../+model/model";
import {AppBus} from "../../app-bus/app-bus";
import {WorkspaceLoadedEvent} from "../../workspace/+bus/events";
import {NodeConfig, PaneConfig, TabId} from "../../workspace/+model/workspace";
import {BinaryNode, BinaryTree} from "../../common/tree/binary-tree";
import {IdCreator} from "../../common/id-creator/id-creator";


@Injectable({providedIn: 'root'})
export class GridListService {

    private _gridList: BehaviorSubject<GridList> = new BehaviorSubject<GridList>({});
    get grids$(): Observable<Grid[]> {
        return this._gridList.pipe(map(g => Object.values(g)));
    }

    constructor(private bus: AppBus) {
        this.bus.onType$('WorkspaceLoaded').subscribe((event: WorkspaceLoadedEvent) => {
            for (let pane of event.payload!.panes) {
                this.addGrid(pane);
            }
        });
    }

    addGrid(paneConfig: PaneConfig) {
        const gridList = this._gridList.value;
        if(gridList[paneConfig.id]) return;
        gridList[paneConfig.id] = {id: paneConfig.id, tree: this.createTree(paneConfig)};
        this._gridList.next(gridList);
    }

    private createTree(paneConfig: PaneConfig): BinaryTree<Pane> {
        const rootNode: BinaryNode<Pane> = new BinaryNode();
        this.addNode(rootNode, paneConfig.node);
        return new BinaryTree(rootNode);
    }

    private addNode(parent: BinaryNode<Pane>, nodeConfig: NodeConfig) {
        if(nodeConfig.splitDirection){
            parent.data = {splitDirection: nodeConfig.splitDirection, ratio: nodeConfig.ratio};
            const leftChild: BinaryNode<Pane> = new BinaryNode();
            const rightChild: BinaryNode<Pane> = new BinaryNode();
            parent.addToNode(leftChild, 'l');
            parent.addToNode(rightChild, 'r');
            this.addNode(leftChild, nodeConfig.leftChild)
            this.addNode(rightChild, nodeConfig.rightChild)
        } else {
            parent.data = {shellConfigPosition: nodeConfig.shellConfig, terminalId: IdCreator.newId()};
        }
    }

    removeGrid(tab: TabId) {
        const gridList = this._gridList.value;
        delete gridList[tab];
        this._gridList.next(gridList);
    }
}
