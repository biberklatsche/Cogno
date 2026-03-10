import { ShellSupportDefinitionContract } from "@cogno/core-sdk";

export const gitBashShellSupportDefinition: ShellSupportDefinitionContract = {
  shellType: "GitBash",
  profileName: "gitbash",
  defaultArgumentsByOs: {
    windows: [],
    linux: [],
    macos: [],
  },
  sortWeightByOs: {
    windows: 2,
    linux: 5,
    macos: 5,
  },
  integrationFiles: [],
  integrationTemplateShellType: "Bash",
};
