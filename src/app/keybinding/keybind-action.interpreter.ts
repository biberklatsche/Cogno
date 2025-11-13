import {ActionTrigger, validTriggers} from "../app-bus/app-bus";
import {ActionName} from "../config/+models/config.types";

export type ActionDefinition = {actionName: ActionName, trigger?: {all: boolean, unconsumed: boolean, performable: boolean}, args?: string[]}

export const KeybindActionInterpreter = {

    parse(actionDef: string): ActionDefinition {
        let trigger:{all: boolean, unconsumed: boolean, performable: boolean} | undefined = undefined;
        if(actionDef.includes('[') && actionDef.includes(']')){
            const triggersList = actionDef.substring(actionDef.indexOf('[') + 1, actionDef.lastIndexOf(']')).split(':');
            for (const triggerString of triggersList) {
                if(!trigger) trigger = {all: false, unconsumed: false, performable: false};
                if(!validTriggers.includes(triggerString as ActionTrigger)) continue;
                if(triggerString === 'all'){
                    trigger.all = true;
                }
                if(triggerString === 'performable'){
                    trigger.performable = true;
                }
                if(triggerString === 'unconsumed'){
                    trigger.unconsumed = true;
                }
            }
        }
        const args = actionDef.substring(actionDef.lastIndexOf(']') + 1).split(':');
        const actionName = args.splice(0, 1)[0] as ActionName;
        return {actionName: actionName, trigger: trigger, args: args};
    },
}
