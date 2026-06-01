import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ActionDispatcher,
  AgentStatus,
  parseAgentStatus,
  TerminalAnimationPort,
} from "@cogno/core-api";
import { AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS } from "./coding-agent-animation";

@Injectable({ providedIn: "root" })
export class CodingAgentStatusService {
  constructor(
    actionDispatcher: ActionDispatcher,
    animation: TerminalAnimationPort,
    destroyRef: DestroyRef,
  ) {
    actionDispatcher
      .onActionWithContext$("coding_agent_status")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ args, terminalId }) => {
        if (!terminalId) return;
        const status = parseAgentStatus(args?.[0]);
        if (!status) return;
        if (status === "ready") {
          animation.unregister(terminalId, AGENT_STATUS_REGISTRATION_KEY);
        } else {
          animation.register(
            terminalId,
            AGENT_STATUS_REGISTRATION_KEY,
            AGENT_STATUS_SPECS[status as Exclude<AgentStatus, "ready">],
          );
        }
      });
  }
}
