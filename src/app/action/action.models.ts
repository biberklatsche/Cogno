import {ActionBase, BusPath} from "../app-bus/app-bus";
import {ActionDefinition} from "../keybinding/keybind-action.interpreter";

export type ActionFiredEvent = ActionBase<"ActionFired", ActionName>
export type ActionName =
    'copy' |
    'paste' |
    'new_tab' |
    'close_tab' |
    'split_right' |
    'split_left' |
    'split_down' |
    'split_up' |
    'close_terminal' |
    'clear_buffer' |
    'close_other_tabs' |
    'close_all_tabs'|
    'toggle_inspector'|
    'toggle_workspace'|
    'open_command_palette'|
    'quit'|
    'new_window' |
    'close_window' |
    'minimize_window' |
    'open_config' |
    'toggle_notification'
    ;

export const ActionFired = {
    createFromDefinition: (actionDefinition: ActionDefinition):ActionFiredEvent => ActionFired.create(actionDefinition.actionName, actionDefinition.trigger, actionDefinition.args),
    create: (actionName: ActionName, trigger?: {all: boolean, unconsumed: boolean, performable: boolean}, args?: string[]):ActionFiredEvent =>  ({type: "ActionFired", path: ['app', 'action'], payload: actionName, trigger: trigger, args: args}),
    listener: (): {path: BusPath; type: "ActionFired"} => ({type: 'ActionFired', path: ['app', 'action']})
}
