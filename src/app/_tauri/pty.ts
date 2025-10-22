import {IPty as ITauriPty, spawn} from "tauri-pty";
import {ShellConfig} from "../config/+models/config";
import {IDisposable} from "../common/models/models";

export interface IPty {
    spawn(shellConfig: ShellConfig): void;
    resize(width: number, height: number): void;
    onData(listener: (e: string) => any): IDisposable;
    write(data: string): void;
    onExit(listener: (e: {exitCode: number, signal?: number}) => any): IDisposable;
}

export class Pty implements IPty {

    private pty: ITauriPty | undefined = undefined;

    spawn(shellConfig: ShellConfig) {
        this.pty = spawn(shellConfig.path, shellConfig.args, {
            cols: 80,
            rows: 80,
        })
    }

    resize(cols: number, rows: number) {
        if(!this.pty) throw Error('Please spawn Pty before resize.');
        this.pty?.resize(cols, rows);
    }

    onData( listener: (e: string) => any): IDisposable {
        if(!this.pty) throw Error('Please spawn Pty before listen on data.');
        return this.pty.onData(listener);
    }

    write(data: string) {
        if(!this.pty) throw Error('Please spawn Pty before write to it.');
        return this.pty.write(data);
    }

    onExit(listener: (e: {exitCode: number, signal?: number}) => any): IDisposable {
        if(!this.pty) throw Error('Please spawn Pty before listen on exit.');
        return this.pty.onExit(listener);
    }
}
