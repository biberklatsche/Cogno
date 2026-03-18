import {z} from 'zod';

export const ShellTypeEnum = z.enum(["PowerShell", "ZSH", "Bash", "GitBash", "Fish"]);

export type ShellType = z.infer<typeof ShellTypeEnum>;

export const ShellProfileSchema = z.object({
    shell_type: ShellTypeEnum,
    path: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    use_conpty: z.boolean().optional(),
    working_dir: z.string().optional(),
    inject_cogno_cli: z.boolean().default(true),
    enable_shell_integration: z.boolean().default(true),
    load_user_rc: z.boolean().default(true),
}).describe("The shell configuration");

export const ShellProfilesSchema = z.record(z.string().min(1), ShellProfileSchema);

export const ShellConfigSchema = z.object({
    default: z.string().min(1),
    order: z.array(z.string().min(1)).optional(),
    profiles: ShellProfilesSchema,
}).superRefine((s, ctx) => {
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
