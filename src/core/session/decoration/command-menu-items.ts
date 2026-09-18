import { ClipboardAccess } from "@cogno/platform/clipboard";
import { ContextMenuItem } from "@cogno/shared/ui";

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
  /** Present when there is somewhere to filter to; the menu only asks. */
  onFilterBlock?: (range: CommandMenuBlockRange) => void;
  clipboard: ClipboardAccess;
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

        void options.clipboard.writeText(commandText);
      },
    },
    {
      label: "Copy Output",
      disabled: outputText.length === 0,
      action: () => {
        if (outputText.length === 0) {
          return;
        }

        void options.clipboard.writeText(outputText);
      },
    },
    {
      separator: true,
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
      separator: true,
    },
    {
      label: "Filter Block",
      disabled: !options.getBlockRange || !options.onFilterBlock,
      action: () => {
        if (!options.getBlockRange || !options.onFilterBlock) {
          return;
        }

        options.onFilterBlock(options.getBlockRange());
      },
    },
  ];
}
