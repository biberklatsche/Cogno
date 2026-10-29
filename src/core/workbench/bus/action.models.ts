import { ActionBase } from "@cogno/core/workbench/bus/message-base";
import { ActionTriggerContract } from "@cogno/shared/domain";

export type ActionFiredEvent = ActionBase<"ActionFired", ActionName> & {
  /** Set when the action targets a specific terminal, e.g. via HTTP IPC. Handlers that need terminal-scoped behaviour should check this field. */
  terminalId?: string;
};
export type ActionName = string;

export const ActionFired = {
  create: (
    actionName: ActionName,
    trigger?: ActionTriggerContract,
    args?: string[],
    terminalId?: string,
  ): ActionFiredEvent => ({
    type: "ActionFired",
    payload: actionName,
    trigger: trigger,
    args: args,
    terminalId: terminalId,
  }),
};
