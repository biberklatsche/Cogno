import { ActionFired } from "../../../../action/action.models";
import { AppBus } from "../../../../app-bus/app-bus";
import { Clipboard } from "../../../../_tauri/clipboard";
import { ContextMenuItem } from "../../../../menu/context-menu-overlay/context-menu-overlay.types";

export type CommandMenuBlockRange = {
    beginBufferLine: number;
    endBufferLine: number;
};

type CommandMenuItemsOptions = {
    commandText?: string;
    getCommandOutput?: () => string;
    getBlockRange?: () => CommandMenuBlockRange;
    scrollToCommandTop?: () => void;
    scrollToCommandBottom?: () => void;
    appBus?: AppBus;
    terminalId?: string;
};

export function buildCommandMenuItems(options: CommandMenuItemsOptions): ContextMenuItem[] {
    const commandText = options.commandText?.trim() ?? "";
    const outputText = commandText.length > 0 ? (options.getCommandOutput?.().trimEnd() ?? "") : "";

    return [
        {
            label: "Copy Command",
            disabled: commandText.length === 0,
            action: () => {
                if (commandText.length === 0) {
                    return;
                }

                void Clipboard.writeText(commandText);
            },
        },
        {
            label: "Copy Output",
            disabled: outputText.length === 0,
            action: () => {
                if (outputText.length === 0) {
                    return;
                }

                void Clipboard.writeText(outputText);
            },
        },
        {
            label: "Scroll to Top",
            disabled: !options.scrollToCommandTop,
            action: () => {
                options.scrollToCommandTop?.();
            },
        },
        {
            label: "Scroll to Bottom",
            disabled: !options.scrollToCommandBottom,
            action: () => {
                options.scrollToCommandBottom?.();
            },
        },
        {
            label: "Filter Block",
            disabled: !options.getBlockRange || !options.appBus || !options.terminalId,
            action: () => {
                if (!options.getBlockRange || !options.appBus || !options.terminalId) {
                    return;
                }

                const commandMenuBlockRange = options.getBlockRange();
                options.appBus.publish(ActionFired.create("open_terminal_search"));
                options.appBus.publish({
                    path: ["app", "terminal"],
                    type: "TerminalSearchPanelRequested",
                    payload: {
                        terminalId: options.terminalId,
                        beginBufferLine: commandMenuBlockRange.beginBufferLine,
                        endBufferLine: commandMenuBlockRange.endBufferLine,
                    },
                });
            },
        },
    ];
}
