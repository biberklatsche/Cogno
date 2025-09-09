import {IPty as ITauriPty, spawn} from "tauri-pty";
import {IDisposable} from "./event";
import {OS} from './os';

export interface IPty {
    resize(width: number, height: number): void;
    onData(listener: (e: string) => any): IDisposable;
    write(data: string): void;
    onExit(listener: (e: {exitCode: number, signal?: number}) => any): IDisposable;
}

export class Pty implements IPty {

    private pty: ITauriPty;

    constructor() {
        this.pty = spawn(OS.platform() === 'macos' ? "zsh" : "C:\\_dev\\tools\\Git\\bin\\sh.exe", [/* args */], {
            cols: 80,
            rows: 80,
        })
    }

    resize(cols: number, rows: number) {
        if(!this.pty) throw Error('Please initialize Pty before resize.');
        this.pty?.resize(cols, rows);
    }

    onData( listener: (e: string) => any): IDisposable {
        if(!this.pty) throw Error('Please initialize Pty before listen on data.');
        return this.pty.onData(listener);
    }

    write(data: string) {
        if(!this.pty) throw Error('Please initialize Pty before write to it.');
        return this.pty.write(data);
    }

    onExit(listener: (e: {exitCode: number, signal?: number}) => any): IDisposable {
        return this.pty.onExit(listener);
    }
}
