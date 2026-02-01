import {invoke} from "@tauri-apps/api/core";
import {ShellConfig} from "../config/+models/config";
import {TerminalId} from "../grid-list/+model/model";
import {listen} from "@tauri-apps/api/event";
import {TerminalDimensions} from "../terminal/+state/handler/resize.handler";
import {ShellProfile} from "../config/+models/shell-config";
import {Environment} from "../common/environment/environment";

export const TauriPty = {
    spawn(terminalId: TerminalId, shellProfile: ShellProfile, dimensions: TerminalDimensions) {
        const devMode = Environment.isDevMode();
        return invoke('pty_spawn', {
            options: {
                name: terminalId,
                cols: dimensions.cols,
                rows: dimensions.rows,
                profile: shellProfile,
                dev_mode: devMode
            }
        });
    },

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
