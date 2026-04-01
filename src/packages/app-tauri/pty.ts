import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event";
import {ShellConfig} from "@cogno/app/config/+models/config";
import {ShellProfile} from "@cogno/app/config/+models/shell-config";
import {Environment} from "@cogno/app/common/environment/environment";
import {TerminalId} from "@cogno/app/grid-list/+model/model";
import {TerminalDimensions} from "@cogno/app/terminal/+state/handler/resize.handler";

export type ProcessDetails = {
    processId: number;
    parentProcessId: number | null;
    name: string;
    command: string[];
    executablePath: string | null;
    currentWorkingDirectory: string | null;
    rootDirectory: string | null;
    environment: string[];
    status: string;
    startTimeSeconds: number;
    runTimeSeconds: number;
    cpuUsagePercent: number;
    memoryBytes: number;
    virtualMemoryBytes: number;
    diskReadBytes: number;
    diskWrittenBytes: number;
    totalDiskReadBytes: number;
    totalDiskWrittenBytes: number;
    userId: string | null;
    groupId: string | null;
};

export type ProcessTreeSnapshot = {
    rootProcessId: number;
    directChildProcessIds: number[];
    descendantProcessIds: number[];
    rootProcess: ProcessDetails;
    directChildren: ProcessDetails[];
    descendants: ProcessDetails[];
};

export type TauriUnlistenFn = () => void;

export type PtySpawnResult = {
    shellProcessId: number | null;
};

export const TauriPty = {
    spawn(terminalId: TerminalId, shellProfile: ShellProfile, dimensions: TerminalDimensions) {
        const devMode = Environment.isDevMode();
        return invoke<PtySpawnResult>('pty_spawn', {
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
        });
    },

    resize(terminalId: TerminalId, cols: number, rows: number) {
        return invoke('pty_resize', {
            terminalId: terminalId,
            cols,
            rows
        });
    },

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
        });
    },

    executeShellAction(terminalId: TerminalId, action: string, payload?: object) {
        return invoke('pty_execute_shell_action', {
            terminalId,
            action,
            payloadJson: payload ? JSON.stringify(payload) : null,
        });
    },

    getProcessTreeByProcessId(processId: number) {
        return invoke<ProcessTreeSnapshot>('pty_get_process_tree_by_pid', {
            processId
        });
    },

    getProcessTreeByTerminalId(terminalId: TerminalId) {
        return invoke<ProcessTreeSnapshot>('pty_get_process_tree_by_terminal_id', {
            terminalId
        });
    }
}
