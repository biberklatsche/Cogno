import {ActionBase, BusPath} from "../app-bus/app-bus";
import {ActionDefinition} from "../keybinding/keybind-action.interpreter";

export type ActionFiredEvent = ActionBase<"ActionFired", ActionName>
export const ACTION_NAMES = [
    'copy',
    'paste',
    'new_tab',
    'close_tab',
    'split_right',
    'split_left',
    'split_down',
    'split_up',
    'close_terminal',
    'clear_buffer',
    'close_other_tabs',
    'close_all_tabs',
    'open_inspector',
    'open_workspace',
    'open_command_palette',
    'open_notification',
    'quit',
    'new_window',
    'close_window',
    'minimize_window',
    'open_config',
    'load_config',
    'clear_line'
] as const;

export type ActionName = typeof ACTION_NAMES[number];


export const ActionFired = {
    createFromDefinition: (actionDefinition: ActionDefinition):ActionFiredEvent => ActionFired.create(actionDefinition.actionName, actionDefinition.trigger, actionDefinition.args),
    create: (actionName: ActionName, trigger?: {all: boolean, unconsumed: boolean, performable: boolean}, args?: string[]):ActionFiredEvent =>  ({type: "ActionFired", path: ['app', 'action'], payload: actionName, trigger: trigger, args: args}),
    listener: (): {path: BusPath; type: "ActionFired"} => ({type: 'ActionFired', path: ['app', 'action']})
}
