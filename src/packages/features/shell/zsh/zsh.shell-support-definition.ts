import { ShellSupportDefinitionContract } from "@cogno/core-api";
import zshBootstrapScript from "./bootstrap.zsh.txt?raw";
import zshIntegrationScript from "./integration.zsh.txt?raw";

export const zshShellSupportDefinition: ShellSupportDefinitionContract = {
  shellType: "ZSH",
  profileName: "zsh",
  defaultArgumentsByOs: {
    windows: ["-l", "-i"],
    linux: ["-l", "-i"],
    macos: ["-l", "-i"],
  },
  sortWeightByOs: {
    windows: 4,
    linux: 2,
    macos: 2,
  },
  integrationFiles: [
    {
      relativePath: "zsh/bootstrap.zsh",
      content: zshBootstrapScript,
    },
    {
      relativePath: "zsh/.zshrc",
      content: zshBootstrapScript,
    },
    {
      relativePath: "zsh/integration.zsh",
      content: zshIntegrationScript,
    },
  ],
};



