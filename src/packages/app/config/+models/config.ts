import {
  FeatureAiSchema,
  FeatureAutocompleteSchema,
  FeatureCodingAgentsSchema,
  FeatureCommandPaletteSchema,
  FeatureGitSchema,
  FeatureNotificationSchema,
  FeatureNotificationsSchema,
  FeatureSearchSchema,
  FeatureTerminalSchema,
  FeatureWorkspaceSchema,
} from "@cogno/core-api";
import { z } from "zod";
import { ClipboardConfig, ClipboardConfigSchema } from "./clipboard-config";
import { Color, ColorSchema } from "./color-config";
import { Cursor, CursorSchema } from "./cursor-config";
import { Font, FontSchema } from "./font-config";
import { ImageSchema } from "./image-config";
import { Keybinding, KeybindsSchema } from "./keybind-config";
import { MenuSchema } from "./menu-config";
import { Padding, PaddingSchema } from "./padding-config";
import { PromptConfigSchema } from "./prompt-config";
import { Scrollbar, ScrollbarSchema } from "./scrollbar-config";
import { Selection, SelectionSchema } from "./selection-config";
import { FeatureMode, HexColor } from "./shared";
import { ShellConfig, ShellConfigSchema, ShellType } from "./shell-config";

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
  enabled: z.boolean().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  auto_next_port: z.boolean().optional(),
});

export type HttpServerConfig = z.infer<typeof HttpServerSchema>;

export const baseConfigSchemaShape = {
  keybind: KeybindsSchema.optional(),
  enable_watch_config: z.boolean().optional(),
  font: FontSchema.optional(),
  color: ColorSchema.optional(),
  cursor: CursorSchema.optional(),
  padding: PaddingSchema.optional(),
  background_image: ImageSchema.optional(),
  shell: ShellConfigSchema.optional(),
  selection: SelectionSchema.optional(),
  clipboard: ClipboardConfigSchema.optional(),
  menu: MenuSchema.optional(),
  scrollbar: ScrollbarSchema.optional(),
  prompt: PromptConfigSchema.optional(),
  http_server: HttpServerSchema.optional(),
} satisfies z.ZodRawShape;

export const featureConfigSchemaShape = {
  workspace: FeatureWorkspaceSchema.optional(),
  notification: FeatureNotificationSchema.optional(),
  notifications: FeatureNotificationsSchema.optional(),
  command_palette: FeatureCommandPaletteSchema.optional(),
  terminal: FeatureTerminalSchema.optional(),
  autocomplete: FeatureAutocompleteSchema.optional(),
  search: FeatureSearchSchema.optional(),
  ai: FeatureAiSchema.optional(),
  git: FeatureGitSchema.optional(),
  coding_agents: FeatureCodingAgentsSchema.optional(),
} satisfies z.ZodRawShape;

export const ConfigSchema = z
  .object({
    ...baseConfigSchemaShape,
    ...featureConfigSchemaShape,
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema> & Record<string, unknown>;
