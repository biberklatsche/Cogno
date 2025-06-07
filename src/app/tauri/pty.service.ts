import { Injectable } from "@angular/core";
import {IPty as ITauriPty, spawn} from "tauri-pty";
import {IDisposable} from "./event";

export interface IPty {
    init(): void;
    resize(width: number, height: number): void;
    onData(listener: (e: string) => any): IDisposable;
    write(data: string): void;
}

@Injectable()
export class PtyService implements IPty {

    private pty?: ITauriPty = undefined;

    constructor() { }

    init() {
         this.pty = spawn("zsh", [/* args */], {
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
}
