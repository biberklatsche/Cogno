import {ActionBase, BusPath} from "../app-bus/app-bus";
import {ActionDefinition} from "../keybinding/keybind-action.interpreter";

export type ActionFiredEvent = ActionBase<"ActionFired", ActionName>
export const ACTION_NAMES = [
    'copy',
    'paste',
    'cut',
    'new_tab',
    'close_tab',
    'split_right',
    'split_left',
    'split_down',
    'split_up',
    'maximize_pane',
    'minimize_pane',
    'close_terminal',
    'clear_buffer',
    'close_other_tabs',
    'close_all_tabs',
    'open_inspector',
    'open_workspace',
    'open_command_palette',
    'open_terminal_search',
    'open_notification',
    'quit',
    'new_window',
    'close_window',
    'minimize_window',
    'open_config',
    'load_config',
    'cycle_completion_mode',
    'clear_line',
    'clear_line_to_end',
    'clear_line_to_start',
    'delete_previous_word',
    'delete_next_word',
    'go_to_next_word',
    'go_to_previous_word',
    'select_all',
    'select_text_right',
    'select_text_left',
    'select_word_right',
    'select_word_left',
    'select_text_to_end_of_line',
    'select_text_to_start_of_line',
] as const;

export type ActionName = typeof ACTION_NAMES[number];


export const ActionFired = {
    createFromDefinition: (actionDefinition: ActionDefinition):ActionFiredEvent => ActionFired.create(actionDefinition.actionName, actionDefinition.trigger, actionDefinition.args),
    create: (actionName: ActionName, trigger?: {all: boolean, unconsumed: boolean, performable: boolean}, args?: string[]):ActionFiredEvent =>  ({type: "ActionFired", path: ['app', 'action'], payload: actionName, trigger: trigger, args: args}),
    listener: (): {path: BusPath; type: "ActionFired"} => ({type: 'ActionFired', path: ['app', 'action']})
}
