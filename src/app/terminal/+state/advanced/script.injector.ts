import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {TerminalId} from "../../../grid-list/+model/model";
import {IPty} from "../pty/pty";
import {Subscription} from "rxjs";
import {Char} from "../../../common/chars/chars";
import {invoke} from "@tauri-apps/api/core";
import {ShellType} from "../../../config/+models/config";
import {Script} from '../../../_tauri/script';
import { Logger } from "../../../_tauri/logger";

export class ScriptInjector implements IDisposable{

    private subscription = new Subscription();

    constructor(bus: AppBus, pty: IPty, terminalId: TerminalId) {
        this.subscription.add(bus.on$({type: 'PtyInitialized', path: ['app', 'terminal', terminalId], phase: "target"}).subscribe(async (e) => {
            const shellType = e.payload!.shellType;
            console.log('#####', shellType);
            try {
                const content = await Script.read(shellType);

                if (content && content.trim().length > 0) {
                    pty.write(content + Char.Enter);
                } else {
                    Logger.warn(`Failed to get script for ${shellType}: ${content}`);
                }
            } catch (error) {
                Logger.error('Could not load script: ' + error);
            }
        }));
    }

    dispose(): void {
        this.subscription.unsubscribe();
    }
}
