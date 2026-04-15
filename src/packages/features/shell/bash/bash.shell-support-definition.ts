import { ShellSupportDefinitionContract } from "@cogno/core-api";
import bashBootstrapScript from "./bootstrap.bash.txt?raw";
import bashIntegrationScript from "./integration.bash.txt?raw";

export const bashShellSupportDefinition: ShellSupportDefinitionContract = {
  shellType: "Bash",
  profileName: "bash",
  defaultArgumentsByOs: {
    windows: [],
    linux: [],
    macos: [],
  },
  sortWeightByOs: {
    windows: 3,
    linux: 3,
    macos: 3,
  },
  integrationFiles: [
    {
      relativePath: "bash/bootstrap.bash",
      content: bashBootstrapScript,
    },
    {
      relativePath: "bash/integration.bash",
      content: bashIntegrationScript,
    },
  ],
};
