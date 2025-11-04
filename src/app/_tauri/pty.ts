import {invoke} from "@tauri-apps/api/core";
import {ShellConfig} from "../config/+models/config.types";
import {TerminalId} from "../grid-list/+model/model";
import {listen} from "@tauri-apps/api/event";

export const TauriPty = {
    spawn(terminalId: TerminalId, shellConfig: ShellConfig) {
        return invoke('pty_spawn', {
        program: shellConfig.path,
        args: shellConfig.args,
        options: {
            name: terminalId,
            cols: 80,
            rows: 25
        }
    });},

    kill(terminalId: TerminalId) {
        return invoke('pty_kill', {
            terminalId: terminalId
    });},

    resize(terminalId: TerminalId, cols: number, rows: number) {
        return invoke('pty_resize', {
            terminalId: terminalId,
            cols,
            rows
        });},

    onData(terminalId: TerminalId, listener: (data: string) => void) {
        return listen<string>(`pty-data:${terminalId}`, (event) => {
            listener(event.payload);
        });
    },

    onExit(terminalId: TerminalId, listener: (event: {exitCode: number, signal?: number}) => void) {
        return listen<{exitCode: number, signal?: number}>(`pty-exit:${terminalId}`, (event) => {
            listener(event.payload);
        });
    },

    write(terminalId: TerminalId, data: string) {
        return invoke('pty_write', {
            terminalId: terminalId,
            data
        })
    }
}
