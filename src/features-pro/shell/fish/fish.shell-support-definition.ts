import { ShellSupportDefinitionContract } from "@cogno/core-sdk";
import fishBootstrapScript from "./bootstrap.fish.txt?raw";
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
      relativePath: "fish/bootstrap.fish",
      content: fishBootstrapScript,
    },
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
