import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {ITerminalHandler} from "../handler/handler";
import {Command, SessionState} from "../session.state";
import OscParser from "./cogno-osc.parser";


export class CognoOscHandler implements ITerminalHandler {

    private _disposables?: IDisposable[] = undefined;

    constructor(private sessionState: SessionState) {
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._disposables = [];
        this._disposables.push(terminal.parser
            .registerOscHandler(733, (data: string) => {
                this.sessionState.isCommandRunning = false;
                const kv = OscParser.parse(data);
                if(!kv) return true;
                //'COGNO:PROMPT;r=0;u=larswolfram;m=Air-von-Lars;d=/Users/larswolfram;t=7;c=ls;'
                const command: Command = {
                    command: kv['c'],
                    directory: kv['d'],
                    returnCode: Number.parseInt(kv['r']),
                    id: kv['t']
                }
                this.sessionState.addCommand(command);
                return true;
            }));
        return this;
    }

    dispose(): void {
        if (!this._disposables) return;
        this._disposables.forEach(d => d.dispose());
        this._disposables = undefined;
    }
}
