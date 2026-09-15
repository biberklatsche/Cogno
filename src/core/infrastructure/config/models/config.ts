import { ApplicationSettingsSectionDefinitionContract } from "@cogno/shared/contributions";
import { z } from "zod";
import { AutocompleteSettingsSchema } from "./autocomplete-settings";
import { ClipboardConfig, ClipboardConfigSchema } from "./clipboard-config";
import { Color, ColorSchema } from "./color-config";
import { Cursor, CursorSchema } from "./cursor-config";
import { Font, FontSchema } from "./font-config";
import { ImageSchema } from "./image-config";
import { Keybinding, KeybindsSchema } from "./keybind-config";
import { MenuSchema } from "./menu-config";
import { NotificationSettingsSchema } from "./notification-settings";
import { Padding, PaddingSchema } from "./padding-config";
import { PromptConfigSchema } from "./prompt-config";
import { Scrollbar, ScrollbarSchema } from "./scrollbar-config";
import { Selection, SelectionSchema } from "./selection-config";
import { FeatureMode, HexColor } from "./shared";
import { ShellConfig, ShellConfigSchema, ShellType } from "./shell-config";
import { TerminalSettingsSchema } from "./terminal-settings";

export {
  ClipboardConfig,
  Color,
  Cursor,
  FeatureMode,
  Font,
  HexColor,
  Keybinding,
  Padding,
  Scrollbar,
  Selection,
  ShellConfig,
  ShellType,
};

export const HTTP_SERVER_DEFAULTS = {
  enabled: true,
  port: 9000,
  auto_next_port: true,
} as const;

export const HttpServerSchema = z.object({
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

export type HttpServerConfig = z.infer<typeof HttpServerSchema>;

export const baseConfigSchemaShape = {
  keybind: KeybindsSchema.optional().describe("Keybinding lines; see the keybinding syntax."),
  enable_watch_config: z
    .boolean()
    .optional()
    .describe("Reload the config automatically when the file changes on disk."),
  font: FontSchema.optional().describe("Terminal and app fonts."),
  color: ColorSchema.optional().describe("Terminal colour palette."),
  cursor: CursorSchema.optional().describe("Cursor shape, colour and behaviour."),
  padding: PaddingSchema.optional().describe("Padding around the terminal content."),
  background_image: ImageSchema.optional().describe("Optional terminal background image."),
  shell: ShellConfigSchema.optional().describe("Shell profiles and which one starts by default."),
  selection: SelectionSchema.optional().describe("Text selection colours and behaviour."),
  clipboard: ClipboardConfigSchema.optional().describe("Clipboard access and copy behaviour."),
  menu: MenuSchema.optional().describe("Appearance of menus and panels."),
  scrollbar: ScrollbarSchema.optional().describe("Scrollbar appearance and scrolling behaviour."),
  prompt: PromptConfigSchema.optional().describe("The configurable prompt rendered by Cogno."),
  http_server: HttpServerSchema.optional().describe("Local HTTP server used by the CLI."),
  notification: NotificationSettingsSchema.optional().describe("Which events notify you, and how."),
  terminal: TerminalSettingsSchema.optional().describe("Terminal rendering and behaviour."),
  autocomplete: AutocompleteSettingsSchema.optional().describe("Command autocomplete behaviour."),
} satisfies z.ZodRawShape;

export const baseSettingsSections: ReadonlyArray<ApplicationSettingsSectionDefinitionContract> = [
  { id: "notification", title: "Notification", order: 300 },
  { id: "terminal", title: "Terminal", order: 500 },
  { id: "autocomplete", title: "Autocomplete", order: 600 },
];

export const ConfigSchema = z
  .object({
    ...baseConfigSchemaShape,
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema> & Record<string, unknown>;
