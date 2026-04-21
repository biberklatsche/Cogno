import {
  FeatureAutocompleteSchema,
  FeatureCommandPaletteSchema,
  FeatureNotificationSchema,
  FeatureNotificationsSchema,
  FeatureSearchSchema,
  FeatureTerminalSchema,
  FeatureWorkspaceSchema,
} from "@cogno/core-api";
import { z } from "zod";
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
  HexColor,
  FeatureMode,
  Font,
  Color,
  Cursor,
  Padding,
  ShellConfig,
  ShellType,
  Selection,
  Scrollbar,
  Keybinding,
};

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
  menu: MenuSchema.optional(),
  scrollbar: ScrollbarSchema.optional(),
  prompt: PromptConfigSchema.optional(),
} satisfies z.ZodRawShape;

export const featureConfigSchemaShape = {
  workspace: FeatureWorkspaceSchema.optional(),
  notification: FeatureNotificationSchema.optional(),
  notifications: FeatureNotificationsSchema.optional(),
  command_palette: FeatureCommandPaletteSchema.optional(),
  terminal: FeatureTerminalSchema.optional(),
  autocomplete: FeatureAutocompleteSchema.optional(),
  search: FeatureSearchSchema.optional(),
} satisfies z.ZodRawShape;

export const ConfigSchema = z
  .object({
    ...baseConfigSchemaShape,
    ...featureConfigSchemaShape,
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema> & Record<string, unknown>;
