import { GitAccessOption, GitAccessPlatform, GitAccessStep } from "./git-host";

/** The Git Credential Manager: browser sign-in on the next push, token in the system's keychain. */
export function managerOption(label: string, platform: GitAccessPlatform): GitAccessOption {
  return {
    title: "Git Credential Manager",
    detail: `Signs in to ${label} in the browser on the next push and keeps the token in your system's keychain.`,
    steps: [managerStep(platform)],
  };
}

function managerStep(platform: GitAccessPlatform): GitAccessStep {
  switch (platform) {
    case "macos":
      return {
        title: "Install Git Credential Manager",
        detail: "Registers itself as git's helper.",
        commands: ["brew install --cask git-credential-manager"],
      };
    case "windows":
      return {
        title: "Use the manager Git for Windows ships",
        detail: "Registers it as git's helper if the installer did not.",
        commands: ["git credential-manager configure"],
      };
    case "wsl":
      return {
        title: "Use the manager of Git for Windows from WSL",
        detail: "The Windows manager serves git inside the distro.",
        commands: [
          'git config --global credential.helper "/mnt/c/Program\\ Files/Git/mingw64/bin/git-credential-manager.exe"',
        ],
      };
    case "linux":
      return {
        title: "Install Git Credential Manager",
        detail: "Download the package for your distribution, then register it.",
        commands: ["git credential-manager configure"],
        link: "https://github.com/git-ecosystem/git-credential-manager/releases",
      };
  }
}
