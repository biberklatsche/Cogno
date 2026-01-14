import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {TerminalId} from "../../../grid-list/+model/model";
import {IPty} from "../pty/pty";
import {Subscription} from "rxjs";
import {Char} from "../../../common/chars/chars";

export class ScriptInjector implements IDisposable{

    private subscription = new Subscription();

    constructor(bus: AppBus, pty: IPty, terminalId: TerminalId) {
        this.subscription.add(bus.on$({type: 'PtyInitialized', path: ['app', 'terminal', terminalId], phase: "target"}).subscribe(() => {
            setTimeout(() => pty.write('echo "Hello World";' + Char.Enter));
        }));
    }

    dispose(): void {
        this.subscription.unsubscribe();
    }
}
