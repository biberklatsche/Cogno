import {UnlistenFn} from "@tauri-apps/api/event";
import {ShellConfig} from "../../../config/+models/config.types";
import {IDisposable} from "../../../common/models/models";
import {Logger} from "../../../_tauri/logger";
import {TauriPty} from "../../../_tauri/pty";
import {TerminalDimensions} from '../handler/resize.handler';

export interface IPty extends IDisposable{
    spawn(terminalId: string, shellConfig: ShellConfig, dimensions: TerminalDimensions): Promise<void>;
    resize(dimensions: TerminalDimensions): void;
    onData(listener: (e: string) => any): IDisposable;
    write(data: string): void;
    onExit(listener: (e: {exitCode: number, signal?: number}) => any): IDisposable;
    kill(signal?: string): void;
}

export class Pty implements IPty {

    private static readonly _instances = new Set<Pty>();

    static killAll(signal?: string): void {
        // Iterate over a copy to avoid mutation issues during kills/dispose
        Array.from(Pty._instances).forEach(instance => {
            try {
                instance.kill(signal);
            } catch (err) {
                Logger.error('Failed to kill PTY on window close.');
            }
        });
    }

    private _terminalId: string | undefined = undefined;
    private _dataUnlisten: UnlistenFn | undefined = undefined;
    private _exitUnlisten: UnlistenFn | undefined = undefined;

    constructor() {
        Pty._instances.add(this);
    }

    async spawn(terminalId: string, shellConfig: ShellConfig, dimensions: TerminalDimensions): Promise<void> {
        this._terminalId = terminalId;
        await TauriPty.spawn(this._terminalId, shellConfig, dimensions);
    }

    kill(signal?: string): void {
        if(!this._terminalId) return;
        TauriPty.kill(this._terminalId)
            .catch(err => Logger.error('Failed to kill PTY:', err));
    }

    resize(dimensions: TerminalDimensions) {
        if(!this._terminalId) throw Error('Please spawn Pty before resize.');
        TauriPty.resize(this._terminalId, dimensions.cols, dimensions.rows).catch(err => Logger.error('Failed to resize PTY:', err));
    }

    onData(listener: (e: string) => any): IDisposable {
        if(!this._terminalId) throw Error('Please spawn Pty before listen on data.');
        const terminalId = this._terminalId;
        TauriPty.onData(terminalId, listener).then(unlisten => {
            this._dataUnlisten = unlisten;
        });
        return {
            dispose: () => {
                this._dataUnlisten?.();
                this._dataUnlisten = undefined;
            }
        };
    }

    write(data: string) {
        if(!this._terminalId) throw Error('Please spawn Pty before write to it.');
        TauriPty.write(this._terminalId, data)
            .catch(err => console.error('Failed to write to PTY:', err));
    }

    onExit(listener: (e: {exitCode: number, signal?: number}) => any): IDisposable {
        if(!this._terminalId) throw Error('Please spawn Pty before listen on exit.');
        const terminalId = this._terminalId;
        TauriPty.onExit(terminalId, listener).then(unlisten => {
            this._exitUnlisten = unlisten;
        });
        return {
            dispose: () => {
                this._exitUnlisten?.();
                this._exitUnlisten = undefined;
            }
        };
    }

    dispose(): void {
        this.kill();
        this._dataUnlisten?.();
        this._exitUnlisten?.();
        this._dataUnlisten = undefined;
        this._exitUnlisten = undefined;
        this._terminalId = undefined;
        Pty._instances.delete(this);
    }
}
