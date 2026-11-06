import { Injectable } from "@angular/core";
import { TerminalProcess, TerminalProcessesPort } from "@cogno/core/api/terminal-processes-port";
import { TauriPty } from "@cogno/platform/pty";

@Injectable({ providedIn: "root" })
export class TerminalProcessesAdapterService extends TerminalProcessesPort {
  async snapshot(): Promise<ReadonlyArray<TerminalProcess>> {
    const processes = await TauriPty.listTerminalProcesses();
    return processes.map((process) => ({
      terminalId: process.terminalId,
      name: process.name,
      ...(process.currentWorkingDirectory ? { cwd: process.currentWorkingDirectory } : {}),
      startedAt: process.startedAt,
    }));
  }
}
