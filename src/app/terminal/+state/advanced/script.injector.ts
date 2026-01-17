import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {TerminalId} from "../../../grid-list/+model/model";
import {IPty} from "../pty/pty";
import {Subscription} from "rxjs";
import {Char} from "../../../common/chars/chars";
import { Logger } from "../../../_tauri/logger";
import {AdapterFactory} from './adapter/adapter.factory';

export class ScriptInjector implements IDisposable{

    private subscription = new Subscription();

    constructor(bus: AppBus, pty: IPty, terminalId: TerminalId) {
        this.subscription.add(bus.on$({type: 'PtyInitialized', path: ['app', 'terminal', terminalId], phase: "target"}).subscribe(async (e) => {
            // Wait a bit to ensure the shell is ready for input and to reduce the chance of visible injection
            await new Promise(resolve => setTimeout(resolve, 100));

            const adapter = AdapterFactory.create(e.payload!.shellType);
            try {
                const content = await adapter.injectionScript();
                if (content && content.trim().length > 0) {
                    pty.write(content + Char.Enter);
                } else {
                    Logger.warn(`Failed to get script for ${e.payload!.shellType}: ${content}`);
                }
            } catch (error) {
                Logger.error('Could not load script: ' + error);
            } finally {
                this.dispose();
            }
        }));
    }

    dispose(): void {
        this.subscription.unsubscribe();
    }
}
