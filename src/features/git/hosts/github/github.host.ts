import { GitHostDefinition } from "../_shared/git-host";

/** github.com and GitHub Enterprise Server, through `gh`. */
export const GITHUB_HOST: GitHostDefinition = {
  id: "github",
  label: "GitHub",
  owns: (host) => host === "github.com",
  cli: {
    name: "gh",
    home: "github.com",
    installLink: "https://github.com/cli/cli#installation",
    setupHelper: (host) => `gh auth setup-git${host === "github.com" ? "" : ` --hostname ${host}`}`,
  },
  manager: () => true,
  token:
    "GitHub does not accept your account password; create a personal access token with the repo scope",
  sshKeyRegistration: () => ({
    title: "Register the key",
    detail: "With gh signed in; or paste the public key in the account settings.",
    commands: ["gh ssh-key add ~/.ssh/id_ed25519.pub"],
  }),
};
