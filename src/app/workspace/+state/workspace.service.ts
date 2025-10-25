import {Injectable} from "@angular/core";
import {AppBus} from "../../app-bus/app-bus";
import {IdCreator} from "../../common/id-creator/id-creator";
import {TerminalConfig, GridConfig, SplitNode, WorkspaceConfig} from "../+model/workspace";

@Injectable({providedIn: 'root'})
export class WorkspaceService {

    constructor(private bus: AppBus) {
        this.bus.onceType$('ConfigLoaded').subscribe(e => {
            //load workspaces
            let workspace: WorkspaceConfig | undefined = undefined;
            if(workspace === undefined) {
                /*const nodeLeft: TerminalConfig = {};
                const nodeRight: TerminalConfig = {};
                const parent: SplitNode = {
                    splitDirection: 'vertical',
                    ratio: 0.5,
                    leftChild: nodeLeft,
                    rightChild: nodeRight,
                }*/
                const pane: GridConfig = {tabId: IdCreator.newTabId(), pane: {}};
                workspace = {grids: [pane]};
            } else {
                //restore workspace
            }
            this.bus.publish({type: 'WorkspaceLoaded', payload: workspace});
        });
    }
}
