import { ActionBase } from "@cogno/core/workbench/bus/app-bus";

export type ActionFiredEvent = ActionBase<"ActionFired", ActionName> & {
  /** Set when the action targets a specific terminal, e.g. via HTTP IPC. Handlers that need terminal-scoped behaviour should check this field. */
  terminalId?: string;
};
export type ActionName = string;

export const ActionFired = {
  createFromDefinition: (actionDefinition: {
    actionName: ActionName;
    trigger?: ActionFiredEvent["trigger"];
    args?: string[];
  }): ActionFiredEvent =>
    ActionFired.create(
      actionDefinition.actionName,
      actionDefinition.trigger,
      actionDefinition.args,
    ),
  create: (
    actionName: ActionName,
    trigger?: { broadcast: boolean; unconsumed: boolean; performable: boolean; always: boolean },
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
