import { z } from "zod";
import { AutocompleteConfigSchema } from "./autocomplete-config";
import { ClipboardConfigSchema } from "./clipboard-config";
import { Color, ColorSchema } from "./color-config";
import { CursorSchema } from "./cursor-config";
import { FontSchema } from "./font-config";
import { ImageSchema } from "./image-config";
import { KeybindsSchema } from "./keybind-config";
import { MenuSchema } from "./menu-config";
import { NotificationConfigSchema } from "./notification-config";
import { PaddingSchema } from "./padding-config";
import { PromptConfigSchema } from "./prompt-config";
import { RemoteConfigSchema } from "./remote-config";
import { ScrollbarSchema } from "./scrollbar-config";
import { SelectionSchema } from "./selection-config";
import { ShellConfigSchema, ShellType } from "./shell-config";
import { TerminalConfigSchema } from "./terminal-config";
import { UpdaterConfigSchema } from "./updater-config";

export { Color, ShellType };

/**
 * The top-level keys in the order the settings panel and the reference show
 * them; each group, map or list is a section named after its key, plain values
 * share "General". The description is what the reference prints under it.
 */
export const baseConfigSchemaShape = {
  enable_watch_config: z
    .boolean()
    .optional()
    .describe("Apply changes to the settings file as soon as it is saved."),
  font: FontSchema.optional().describe("Terminal and app fonts."),
  color: ColorSchema.optional().describe(
    "Terminal color palette. Colors are hex without `#`; 8 digits add alpha.",
  ),
  cursor: CursorSchema.optional().describe("Cursor shape, color and behaviour."),
  padding: PaddingSchema.optional().describe("Padding around the terminal content."),
  background_image: ImageSchema.optional().describe("Optional terminal background image."),
  menu: MenuSchema.optional().describe("Appearance of menus and panels."),
  scrollbar: ScrollbarSchema.optional().describe("Scrollbar appearance and scrolling behaviour."),
  selection: SelectionSchema.optional().describe("Text selection colors and behaviour."),
  clipboard: ClipboardConfigSchema.optional().describe("Clipboard access and copy behaviour."),
  shell: ShellConfigSchema.optional().describe(
    "Shell profiles and which one starts by default. `<name>` is a profile name you choose. At most 9 profiles; `shell.default` must name one of them.",
  ),
  remote: RemoteConfigSchema.optional().describe(
    "Other machines whose shells Cogno can show, reached over ssh. `<name>` is a name you choose for the machine.",
  ),
  prompt: PromptConfigSchema.optional().describe(
    "The configurable prompt rendered by Cogno. `<name>` is a profile or segment name you choose. A segment sets exactly one of `field` or `text`.",
  ),
  keybind: KeybindsSchema.optional().describe(
    "A key for an action, one per line, e.g. `keybind = Command+T=new_tab`. Your lines add to the defaults; the last line for an action wins.",
  ),
  terminal: TerminalConfigSchema.optional().describe("Terminal rendering and behaviour."),
  autocomplete: AutocompleteConfigSchema.optional().describe("Command autocomplete behaviour."),
  notification: NotificationConfigSchema.optional().describe("Which events notify you, and how."),
  updater: UpdaterConfigSchema.optional().describe("How Cogno keeps itself up to date."),
} satisfies z.ZodRawShape;

export const ConfigSchema = z
  .object({
    ...baseConfigSchemaShape,
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema> & Record<string, unknown>;
