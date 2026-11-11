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
import { RemoteConfigSchema } from "./remote-config";
import { ScrollbarSchema } from "./scrollbar-config";
import { SelectionSchema } from "./selection-config";
import { ShellConfigSchema, ShellType } from "./shell-config";
import { TerminalSettingsSchema } from "./terminal-settings";
import { UpdaterSettingsSchema } from "./updater-settings";

export { Color, ShellType };

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

/**
 * The top-level keys in the order the settings panel and the reference show
 * them; each group, map or list is a section named after its key, plain values
 * share "General". The description is what the reference prints under it.
 */
export const baseConfigSchemaShape = {
  enable_watch_config: z
    .boolean()
    .optional()
    .describe("Reload the config automatically when the file changes on disk."),
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
    "Other machines whose shells Cogno runs, reached over ssh. `<name>` is a host name you choose.",
  ),
  prompt: PromptConfigSchema.optional().describe(
    "The configurable prompt rendered by Cogno. `<name>` is a profile or segment name you choose. A segment sets exactly one of `field` or `text`.",
  ),
  keybind: KeybindsSchema.optional().describe(
    "One keybinding per line: `keybind = [trigger:]combo[>combo...]=action[:arg...]`. Lines add to the defaults; the last line that names an action sets its key.",
  ),
  terminal: TerminalSettingsSchema.optional().describe("Terminal rendering and behaviour."),
  autocomplete: AutocompleteSettingsSchema.optional().describe("Command autocomplete behaviour."),
  notification: NotificationSettingsSchema.optional().describe("Which events notify you, and how."),
  http_server: HttpServerSchema.meta({ title: "HTTP server" })
    .optional()
    .describe("Local HTTP server used by the CLI."),
  updater: UpdaterSettingsSchema.optional().describe("How Cogno keeps itself up to date."),
} satisfies z.ZodRawShape;

/**
 * A shell profile may only name a host that `remote.hosts` defines: two
 * sections, so the check sits on the whole config.
 */
export function checkProfileHosts(config: Record<string, unknown>, ctx: z.RefinementCtx): void {
  const profiles = (config as Config).shell?.profiles ?? {};
  const hosts = (config as Config).remote?.hosts ?? {};
  for (const [name, profile] of Object.entries(profiles)) {
    if (profile.host !== undefined && !(profile.host in hosts)) {
      ctx.addIssue({
        code: "custom",
        path: ["shell", "profiles", name, "host"],
        message: `Host '${profile.host}' of shell profile '${name}' is not defined in remote.hosts.`,
      });
    }
  }
}

export const ConfigSchema = z
  .object({
    ...baseConfigSchemaShape,
  })
  .strict()
  .superRefine(checkProfileHosts);

export type Config = z.infer<typeof ConfigSchema> & Record<string, unknown>;
