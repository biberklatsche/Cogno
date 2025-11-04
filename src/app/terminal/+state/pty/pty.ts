import {UnlistenFn} from "@tauri-apps/api/event";
import {ShellConfig} from "../../../config/+models/config.types";
import {IDisposable} from "../../../common/models/models";
import {Logger} from "../../../_tauri/logger";
import {TauriPty} from "../../../_tauri/pty";

export interface IPty extends IDisposable{
    spawn(terminalId: string, shellConfig: ShellConfig): Promise<void>;
    resize(width: number, height: number): void;
    onData(listener: (e: string) => any): IDisposable;
    write(data: string): void;
    onExit(listener: (e: {exitCode: number, signal?: number}) => any): IDisposable;
    kill(signal?: string): void;
}

export class Pty implements IPty {

    private terminalId: string | undefined = undefined;
    private dataUnlisten: UnlistenFn | undefined = undefined;
    private exitUnlisten: UnlistenFn | undefined = undefined;

    async spawn(terminalId: string, shellConfig: ShellConfig) {
        this.terminalId = terminalId;
        await TauriPty.spawn(this.terminalId, shellConfig);
    }

    kill(signal?: string): void {
        if(!this.terminalId) return;
        TauriPty.kill(this.terminalId)
            .catch(err => Logger.error('Failed to kill PTY:', err));
    }

    resize(cols: number, rows: number) {
        if(!this.terminalId) throw Error('Please spawn Pty before resize.');
        
        TauriPty.resize(this.terminalId, cols, rows).catch(err => Logger.error('Failed to resize PTY:', err));
    }

    onData(listener: (e: string) => any): IDisposable {
        if(!this.terminalId) throw Error('Please spawn Pty before listen on data.');
        const terminalId = this.terminalId;
        TauriPty.onData(terminalId, listener).then(unlisten => {
            this.dataUnlisten = unlisten;
        });
        return {
            dispose: () => {
                this.dataUnlisten?.();
                this.dataUnlisten = undefined;
            }
        };
    }

    write(data: string) {
        if(!this.terminalId) throw Error('Please spawn Pty before write to it.');
        TauriPty.write(this.terminalId, data)
            .catch(err => console.error('Failed to write to PTY:', err));
    }

    onExit(listener: (e: {exitCode: number, signal?: number}) => any): IDisposable {
        if(!this.terminalId) throw Error('Please spawn Pty before listen on exit.');
        const terminalId = this.terminalId;
        TauriPty.onExit(terminalId, listener).then(unlisten => {
            this.exitUnlisten = unlisten;
        });
        return {
            dispose: () => {
                this.exitUnlisten?.();
                this.exitUnlisten = undefined;
            }
        };
    }

    dispose(): void {
        this.kill();
        this.dataUnlisten?.();
        this.exitUnlisten?.();
        this.dataUnlisten = undefined;
        this.exitUnlisten = undefined;
        this.terminalId = undefined;
    }
}
