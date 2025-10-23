import {IPty as ITauriPty, spawn} from "tauri-pty";
import {ShellConfig} from "../config/+models/config";
import {IDisposable} from "../common/models/models";

export interface IPty {
    spawn(terminalId: string, shellConfig: ShellConfig): Promise<void>;
    resize(width: number, height: number): void;
    onData(listener: (e: string) => any): IDisposable;
    write(data: string): void;
    onExit(listener: (e: {exitCode: number, signal?: number}) => any): IDisposable;
    kill(signal?: string): void;
}

export class Pty implements IPty, IDisposable {

    private pty: ITauriPty | undefined = undefined;
    private initDone: Promise<void> | undefined;

    async spawn(terminalId: string, shellConfig: ShellConfig) {
        // Falls vorher schon was lief, nicht parallel überbuchen:
        await this.initDone?.catch(() => {});

        this.pty = spawn(shellConfig.path, shellConfig.args, {name: terminalId, cols: 80, rows: 25 });

        // Wichtig: das interne Init-Promise abwarten.
        // _init ist „privat“, aber in 0.1.x praktisch die einzige Möglichkeit – bis du upgradest.
        const anyPty = this.pty as any;
        this.initDone = (anyPty._init ?? Promise.resolve()) as Promise<void>;

        // Fail fast, falls Init schiefgeht, statt später „pending“ zu bleiben:
        await this.initDone;
        console.log("PTY ready", { pid: anyPty.pid });
    }

    kill(signal?: string): void {
        this.pty?.kill(signal);
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

    dispose(): void {
        this.kill();
        this.pty = undefined;
    }
}
