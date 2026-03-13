import {ActionBase, BusPath} from "../app-bus/app-bus";
import {ActionDefinition} from "../keybinding/keybind-action.interpreter";

export type ActionFiredEvent = ActionBase<"ActionFired", ActionName>
export type ActionName = string;


export const ActionFired = {
    createFromDefinition: (actionDefinition: ActionDefinition):ActionFiredEvent => ActionFired.create(actionDefinition.actionName, actionDefinition.trigger, actionDefinition.args),
    create: (actionName: ActionName, trigger?: {all: boolean, unconsumed: boolean, performable: boolean}, args?: string[]):ActionFiredEvent =>  ({type: "ActionFired", path: ['app', 'action'], payload: actionName, trigger: trigger, args: args}),
    listener: (): {path: BusPath; type: "ActionFired"} => ({type: 'ActionFired', path: ['app', 'action']})
}
