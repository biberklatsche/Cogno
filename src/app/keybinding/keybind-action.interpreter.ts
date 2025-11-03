import {ActionTrigger, validTriggers} from "../app-bus/app-bus";
import {ActionName} from "../config/+models/config";

export const KeybindActionInterpreter = {

    parse(actionDef: string): {actionName: ActionName, triggers?: ActionTrigger[], args?: string[]} {
        let triggers:ActionTrigger[] | undefined = undefined;
        if(actionDef.includes('[') && actionDef.includes(']')){
            const triggersList = actionDef.substring(actionDef.indexOf('[') + 1, actionDef.lastIndexOf(']')).split(':');
            triggersList.forEach(s => {
                if(validTriggers.includes(s as ActionTrigger)){
                    if(!triggers) triggers = [];
                    triggers.push(s as ActionTrigger);
                }
            });
        }
        const args = actionDef.substring(actionDef.lastIndexOf(']') + 1).split(':');
        const actionName = args.splice(0, 1)[0] as ActionName;
        return {actionName: actionName, triggers: triggers, args: args};
    },
}