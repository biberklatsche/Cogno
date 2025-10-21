import {Injectable} from "@angular/core";
import {AppBus} from "../../app-bus/app-bus";
import {IdCreator} from "../../common/id-creator/id-creator";
import {LeafNode, PaneConfig, SplitNode, WorkspaceConfig} from "../+model/workspace";

@Injectable({providedIn: 'root'})
export class WorkspaceService {

    constructor(private bus: AppBus) {
        this.bus.onceType$('ConfigLoaded').subscribe(e => {
            //load workspaces
            let workspace: WorkspaceConfig | undefined = undefined;
            if(workspace === undefined) {
                const nodeLeft: LeafNode = {shellConfig: 1};
                const nodeRight: LeafNode = {shellConfig: 1};
                const parent: SplitNode = {
                    splitDirection: 'vertical',
                    ratio: 0.5,
                    leftChild: nodeLeft,
                    rightChild: nodeRight,
                }
                const pane: PaneConfig = {id: IdCreator.newId(), node: parent};
                workspace = {panes: [pane]};
            } else {
                //restore workspace
            }
            this.bus.publish({type: 'WorkspaceLoaded', payload: workspace});
        });
    }
}
