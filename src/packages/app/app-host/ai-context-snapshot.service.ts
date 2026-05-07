import { Injectable } from "@angular/core";
import { TauriPty } from "@cogno/app-tauri/pty";
import { ConfigService } from "../config/+state/config.service";
import { TerminalId } from "../grid-list/+model/model";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { Command } from "../terminal/+state/state";
import { TerminalSessionRegistry } from "../terminal/+state/terminal-session.registry";
import { TerminalContextCommandSummary, TerminalContextSnapshot } from "./ai-host.models";
import { getAiFeatureConfig } from "./ai-provider-config";

@Injectable({ providedIn: "root" })
export class AiContextSnapshotService {
  constructor(
    private readonly configService: ConfigService,
    private readonly gridListService: GridListService,
    private readonly terminalSessionRegistry: TerminalSessionRegistry,
  ) {}

  async captureFocusedTerminalContext(): Promise<TerminalContextSnapshot | undefined> {
    const focusedTerminalId = this.getFocusedTerminalId();
    if (!focusedTerminalId) {
      return undefined;
    }

    return this.captureTerminalContext(focusedTerminalId);
  }

  async captureTerminalContext(
    terminalId: TerminalId,
  ): Promise<TerminalContextSnapshot | undefined> {
    const terminalSessionEntry = this.terminalSessionRegistry.get(terminalId);
    if (!terminalSessionEntry) {
      return undefined;
    }

    const aiFeatureConfig = getAiFeatureConfig(this.configService.config);
    const maxCommands = aiFeatureConfig?.request?.max_commands ?? 8;
    const maxOutputChars = aiFeatureConfig?.request?.max_output_chars ?? 4000;
    const includeProcessTree = aiFeatureConfig?.request?.include_process_tree ?? false;
    const terminalState = terminalSessionEntry.stateManager.state;

    const commandSummaries = terminalSessionEntry.stateManager.commands
      .slice(-maxCommands)
      .map((command) => this.toCommandSummary(command));

    let processSummary:
      | {
          processId?: number;
          name?: string;
          cwd?: string;
        }
      | undefined;

    if (includeProcessTree) {
      try {
        const processTreeSnapshot = await TauriPty.getProcessTreeByTerminalId(terminalId);
        processSummary = {
          processId: processTreeSnapshot.rootProcess.processId,
          name: processTreeSnapshot.rootProcess.name,
          cwd: processTreeSnapshot.rootProcess.currentWorkingDirectory ?? undefined,
        };
      } catch {
        processSummary = undefined;
      }
    }

    return {
      terminalId,
      tabId: this.gridListService.findTabIdByTerminalId(terminalId),
      workspaceId: this.gridListService.findWorkspaceIdentifierByTerminalId(terminalId),
      shellType: terminalState.shellContext.shellType,
      cwd: terminalState.cwd,
      input: terminalState.input.text,
      isCommandRunning: terminalState.isCommandRunning,
      commands: commandSummaries,
      lastOutput: terminalSessionEntry.session.getRecentOutputSnapshot(60, maxOutputChars),
      latestCommandOutput: terminalSessionEntry.session.getLatestCommandOutputSnapshot(
        Math.min(maxOutputChars, 3000),
      ),
      process: processSummary,
    };
  }

  hasTerminal(terminalId: TerminalId | undefined): boolean {
    return this.terminalSessionRegistry.has(terminalId);
  }

  getFocusedTerminalId(): TerminalId | undefined {
    return this.gridListService.getFocusedTerminalId();
  }

  private toCommandSummary(command: Command): TerminalContextCommandSummary {
    return {
      id: command.id,
      text: command.command,
      cwd: command.directory,
      durationMs: command.duration,
      returnCode: command.returnCode,
    };
  }
}
