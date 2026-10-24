import { GitHostDefinition } from "../_shared/git-host";

/**
 * gitlab.com and self-managed GitLab, through `glab`. The credential manager
 * signs in to gitlab.com only: a self-managed instance would first need an
 * OAuth application registered on the server.
 */
export const GITLAB_HOST: GitHostDefinition = {
  id: "gitlab",
  label: "GitLab",
  owns: (host) => host === "gitlab.com",
  cli: {
    name: "glab",
    home: "gitlab.com",
    installLink: "https://gitlab.com/gitlab-org/cli#installation",
    setupHelper: (host) =>
      `git config --global credential.https://${host}.helper '!glab auth git-credential'`,
  },
  manager: (host) => host === "gitlab.com",
  token: "Create a personal access token with the write_repository scope",
  sshKeyRegistration: () => ({
    title: "Register the key",
    detail: "With glab signed in; or paste the public key in the account settings.",
    commands: ["glab ssh-key add ~/.ssh/id_ed25519.pub"],
  }),
};
