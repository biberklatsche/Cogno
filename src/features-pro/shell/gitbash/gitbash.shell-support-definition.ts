import { ShellSupportDefinitionContract } from "@cogno/core-sdk";
import gitBashBootstrapScript from "./bootstrap.bash.txt?raw";
import gitBashIntegrationScript from "./integration.bash.txt?raw";

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
  integrationFiles: [
    {
      relativePath: "gitbash/bootstrap.bash",
      content: gitBashBootstrapScript,
    },
    {
      relativePath: "gitbash/integration.bash",
      content: gitBashIntegrationScript,
    },
  ],
};
