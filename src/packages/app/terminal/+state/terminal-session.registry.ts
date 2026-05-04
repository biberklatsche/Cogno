import { Injectable } from "@angular/core";
import { ShellProfile } from "../../config/+models/shell-config";
import { TerminalId } from "../../grid-list/+model/model";
import { TerminalStateManager } from "./state";
import { TerminalSession } from "./terminal.session";

type TerminalSessionRegistryEntry = {
  readonly terminalId: TerminalId;
  readonly shellProfile: ShellProfile;
  readonly session: TerminalSession;
  readonly stateManager: TerminalStateManager;
};

@Injectable({ providedIn: "root" })
export class TerminalSessionRegistry {
  private readonly entriesByTerminalId = new Map<TerminalId, TerminalSessionRegistryEntry>();

  register(
    terminalId: TerminalId,
    shellProfile: ShellProfile,
    session: TerminalSession,
    stateManager: TerminalStateManager,
  ): void {
    this.entriesByTerminalId.set(terminalId, {
      terminalId,
      shellProfile,
      session,
      stateManager,
    });
  }

  unregister(terminalId: TerminalId | undefined): void {
    if (!terminalId) {
      return;
    }
    this.entriesByTerminalId.delete(terminalId);
  }

  get(terminalId: TerminalId | undefined): TerminalSessionRegistryEntry | undefined {
    if (!terminalId) {
      return undefined;
    }
    return this.entriesByTerminalId.get(terminalId);
  }

  has(terminalId: TerminalId | undefined): boolean {
    return this.get(terminalId) !== undefined;
  }
}
