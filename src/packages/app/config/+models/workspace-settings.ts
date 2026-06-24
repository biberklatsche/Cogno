import { z } from "zod";
import { featureModeSchema } from "@cogno/core-api";

export const WorkspaceSettingsSchema = z.object({
  mode: featureModeSchema.optional(),
});
