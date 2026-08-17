import { Environment } from "@cogno/app/common/environment/environment";
import { ShellProfile } from "@cogno/app/config/+models/shell-config";
import { TerminalDimensions } from "@cogno/app/terminal/+state/handler/resize.handler";
import { TerminalId } from "@cogno/core-api";
import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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

/**
 * Raw PTY output as delivered by the Rust reader thread. Chunks are ordered;
 * a chunk may end in the middle of a multi-byte UTF-8 sequence, xterm's
 * decoder handles that across writes.
 */
export type PtyDataChannel = Channel<ArrayBuffer>;

export const TauriPty = {
  createDataChannel(): PtyDataChannel {
    return new Channel<ArrayBuffer>();
  },

  spawn(
    terminalId: TerminalId,
    shellProfile: ShellProfile,
    dimensions: TerminalDimensions,
    onData: PtyDataChannel,
  ) {
    const devMode = Environment.isDevMode();
    return invoke<PtySpawnResult>("pty_spawn", {
      options: {
        name: terminalId,
        cols: dimensions.cols,
        rows: dimensions.rows,
        profile: shellProfile,
        dev_mode: devMode,
      },
      onData,
    });
  },

  /** Tells the reader thread that xterm has parsed `bytes` more bytes (flow control). */
  ack(terminalId: TerminalId, bytes: number) {
    return invoke("pty_ack", {
      terminalId: terminalId,
      bytes,
    });
  },

  kill(terminalId: TerminalId) {
    return invoke("pty_kill", {
      terminalId: terminalId,
    });
  },

  resize(terminalId: TerminalId, cols: number, rows: number) {
    return invoke("pty_resize", {
      terminalId: terminalId,
      cols,
      rows,
    });
  },

  onExit(terminalId: TerminalId, listener: (event: { exitCode: number; signal?: number }) => void) {
    return listen<{ exitCode: number; signal?: number }>(`pty-exit:${terminalId}`, (event) => {
      listener(event.payload);
    });
  },

  write(terminalId: TerminalId, data: string) {
    return invoke("pty_write", {
      terminalId: terminalId,
      data,
    });
  },

  executeLineEditorAction(terminalId: TerminalId, action: string, payload?: object) {
    return invoke("pty_execute_line_editor_action", {
      terminalId,
      action,
      payloadJson: payload ? JSON.stringify(payload) : null,
    });
  },

  getProcessTreeByProcessId(processId: number) {
    return invoke<ProcessTreeSnapshot>("pty_get_process_tree_by_pid", {
      processId,
    });
  },

  getProcessTreeByTerminalId(terminalId: TerminalId) {
    return invoke<ProcessTreeSnapshot>("pty_get_process_tree_by_terminal_id", {
      terminalId,
    });
  },
};
