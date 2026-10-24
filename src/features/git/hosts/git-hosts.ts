import { GitHostDefinition, GitHostId } from "./_shared/git-host";
import { AZURE_HOST } from "./azure/azure.host";
import { CODEBERG_HOST } from "./codeberg/codeberg.host";
import { GITHUB_HOST } from "./github/github.host";
import { GITLAB_HOST } from "./gitlab/gitlab.host";
import { OTHER_HOST } from "./other/other.host";

/** Every provider the access dialog knows, in the order it offers them; `other` last. */
export const GIT_HOSTS: ReadonlyArray<GitHostDefinition> = [
  GITHUB_HOST,
  GITLAB_HOST,
  CODEBERG_HOST,
  AZURE_HOST,
  OTHER_HOST,
];

export function gitHost(id: GitHostId): GitHostDefinition {
  return GIT_HOSTS.find((definition) => definition.id === id) ?? OTHER_HOST;
}

/** The provider that owns a host outright; null when the person has to say. */
export function knownGitHost(host: string): GitHostDefinition | null {
  return GIT_HOSTS.find((definition) => definition.owns(host)) ?? null;
}

export function isGitHostId(value: string): value is GitHostId {
  return GIT_HOSTS.some((definition) => definition.id === value);
}
