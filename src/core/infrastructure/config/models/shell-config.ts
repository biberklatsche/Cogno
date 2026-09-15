import { z } from "zod";

const ShellTypeEnum = z.enum(["PowerShell", "ZSH", "Bash"]);

export type ShellType = z.infer<typeof ShellTypeEnum>;

const ShellProfileSchema = z
  .object({
    shell_type: ShellTypeEnum.describe("Which shell this profile launches."),
    path: z.string().optional().describe("Custom executable path; found on PATH when unset."),
    args: z.array(z.string()).optional().describe("Extra launch arguments for the shell."),
    env: z
      .record(z.string(), z.string())
      .optional()
      .describe("Environment variables added to the shell process."),
    use_conpty: z.boolean().optional().describe("Windows only: use the ConPTY backend."),
    working_dir: z.string().optional().describe("Directory the shell starts in."),
    inject_cogno_cli: z
      .boolean()
      .default(true)
      .describe("Put the `cogno` CLI on the shell's PATH."),
    enable_shell_integration: z
      .boolean()
      .default(true)
      .describe("Load Cogno's shell integration (prompt markers, command status, cwd tracking)."),
    load_user_rc: z.boolean().default(true).describe("Also load your own shell rc/profile files."),
  })
  .describe("One shell profile: which shell to start and how.");

const ShellProfilesSchema = z
  .record(z.string().min(1), ShellProfileSchema)
  .describe("Named shell profiles, at most 9.");

export const ShellConfigSchema = z
  .object({
    default: z
      .string()
      .min(1)
      .describe("Name of the profile new terminals start with; must exist in `shell.profiles`."),
    order: z
      .array(z.string().min(1))
      .optional()
      .describe("Order the profiles appear in menus and on the shell-profile shortcuts."),
    profiles: ShellProfilesSchema,
  })
  .superRefine((s, ctx) => {
    const profileNames = Object.keys(s.profiles);

    if (profileNames.length > 9) {
      ctx.addIssue({
        code: "custom",
        path: ["profiles"],
        message: "At most 9 shell profiles may be defined.",
      });
    }

    // default muss existieren
    if (!s.profiles[s.default]) {
      ctx.addIssue({
        code: "custom",
        path: ["default"],
        message: `Default shell profile '${s.default}' is not defined in shell.profiles.`,
      });
    }

    // order darf nur existierende Profile referenzieren
    if (s.order) {
      for (let i = 0; i < s.order.length; i++) {
        const name = s.order[i];
        if (!s.profiles[name]) {
          ctx.addIssue({
            code: "custom",
            path: ["order", i],
            message: `Shell profile '${name}' in shell.order is not defined in shell.profiles.`,
          });
        }
      }
    }
  });

export type ShellConfig = z.infer<typeof ShellConfigSchema>;
export type ShellProfile = z.infer<typeof ShellProfileSchema>;
