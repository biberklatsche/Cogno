import { ShellSupportDefinitionContract } from "@cogno/core-sdk";
import fishBootstrapScript from "./config.fish.txt?raw";
import fishIntegrationScript from "./integration.fish.txt?raw";

export const fishShellSupportDefinition: ShellSupportDefinitionContract = {
  shellType: "Fish",
  profileName: "fish",
  defaultArgumentsByOs: {
    windows: ["-l"],
    linux: ["-l"],
    macos: ["-l"],
  },
  sortWeightByOs: {
    windows: 5,
    linux: 1,
    macos: 1,
  },
  integrationFiles: [
    {
      relativePath: "fish/config.fish",
      content: fishBootstrapScript,
    },
    {
      relativePath: "fish/integration.fish",
      content: fishIntegrationScript,
    },
  ],
};
