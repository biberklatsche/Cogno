import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {TerminalId} from "../../../grid-list/+model/model";
import {IPty} from "../pty/pty";
import {Subscription} from "rxjs";
import {Char} from "../../../common/chars/chars";
import {AdapterFactory} from './adapter/adapter.factory';
import {Environment} from "../../../common/environment/environment";

export class PathInjector implements IDisposable {

    private subscription = new Subscription();

    constructor(bus: AppBus, pty: IPty, terminalId: TerminalId) {
        this.subscription.add(bus.on$({type: 'PtyInitialized', path: ['app', 'terminal', terminalId], phase: "target"}).subscribe(async (e) => {
            const adapter = AdapterFactory.create(e.payload!.shellType);
            const path = Environment.exeDirPath();
            const command = adapter.pathInjection(path);
            pty.write(command + Char.Enter);
        }));
    }

    dispose(): void {
        this.subscription.unsubscribe();
    }
}
