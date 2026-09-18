import { z } from "zod";
import { AutocompleteSettingsSchema } from "./autocomplete-settings";
import { ClipboardConfigSchema } from "./clipboard-config";
import { Color, ColorSchema } from "./color-config";
import { CursorSchema } from "./cursor-config";
import { FontSchema } from "./font-config";
import { ImageSchema } from "./image-config";
import { KeybindsSchema } from "./keybind-config";
import { MenuSchema } from "./menu-config";
import { NotificationSettingsSchema } from "./notification-settings";
import { PaddingSchema } from "./padding-config";
import { PromptConfigSchema } from "./prompt-config";
import { ScrollbarSchema } from "./scrollbar-config";
import { SelectionSchema } from "./selection-config";
import { FeatureMode } from "./shared";
import { ShellConfigSchema, ShellType } from "./shell-config";
import { TerminalSettingsSchema } from "./terminal-settings";

export { Color, FeatureMode, ShellType };

export const HTTP_SERVER_DEFAULTS = {
  enabled: true,
  port: 9000,
  auto_next_port: true,
} as const;

const HttpServerSchema = z.strictObject({
  enabled: z
    .boolean()
    .optional()
    .describe("Run the local HTTP server that the `cogno` CLI talks to."),
  port: z.number().int().min(1).max(65535).optional().describe("Port of the local HTTP server."),
  auto_next_port: z
    .boolean()
    .optional()
    .describe("If the port is taken, try the next free one instead of failing."),
});

export const baseConfigSchemaShape = {
  keybind: KeybindsSchema.optional().describe(
    "One keybinding per line: `keybind = [trigger:]combo[>combo...]=action[:arg...]`. Lines add to the defaults; the last line that names an action sets its key.",
  ),
  enable_watch_config: z
    .boolean()
    .optional()
    .describe("Reload the config automatically when the file changes on disk."),
  font: FontSchema.optional().describe("Terminal and app fonts."),
  color: ColorSchema.optional().describe("Terminal color palette."),
  cursor: CursorSchema.optional().describe("Cursor shape, color and behaviour."),
  padding: PaddingSchema.optional().describe("Padding around the terminal content."),
  background_image: ImageSchema.optional().describe("Optional terminal background image."),
  shell: ShellConfigSchema.optional().describe("Shell profiles and which one starts by default."),
  selection: SelectionSchema.optional().describe("Text selection colors and behaviour."),
  clipboard: ClipboardConfigSchema.optional().describe("Clipboard access and copy behaviour."),
  menu: MenuSchema.optional().describe("Appearance of menus and panels."),
  scrollbar: ScrollbarSchema.optional().describe("Scrollbar appearance and scrolling behaviour."),
  prompt: PromptConfigSchema.optional().describe("The configurable prompt rendered by Cogno."),
  http_server: HttpServerSchema.optional().describe("Local HTTP server used by the CLI."),
  notification: NotificationSettingsSchema.optional().describe("Which events notify you, and how."),
  terminal: TerminalSettingsSchema.optional().describe("Terminal rendering and behaviour."),
  autocomplete: AutocompleteSettingsSchema.optional().describe("Command autocomplete behaviour."),
} satisfies z.ZodRawShape;

export const ConfigSchema = z
  .object({
    ...baseConfigSchemaShape,
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema> & Record<string, unknown>;
