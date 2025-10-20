import {Injectable} from "@angular/core";
import {Tab} from "../+model/tab";
import {BehaviorSubject, Observable} from "rxjs";
import {AppBus} from "../../app-bus/app-bus";
import {ConfigService} from "../../config/+state/config.service";
import {ConfigLoadedEvent} from "../../config/+bus/events";

@Injectable({providedIn: 'root'})
export class WorkspaceService {

    constructor(private bus: AppBus, private configService: ConfigService) {
        this.bus.onceType$('ConfigLoaded').subscribe(e => {
            //load workspaces
            const workspace = undefined;
            if(workspace === undefined) {
                const defaultShell = this.configService.config.shell["1"]!;
            } else {

            }
        });
    }
}

type Workspace = {

}
