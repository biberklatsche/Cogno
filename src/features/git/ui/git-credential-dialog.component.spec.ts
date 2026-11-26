import { DialogRef } from "@cogno/shared/ui";
import { describe, expect, it, vi } from "vitest";
import {
  GitCredentialDialogComponent,
  GitCredentialDialogResult,
} from "./git-credential-dialog.component";

function setup() {
  const close = vi.fn();
  const component = new GitCredentialDialogComponent(
    { close } as unknown as DialogRef<GitCredentialDialogResult>,
    {
      origin: "https://gitlab.com",
      host: "gitlab.com",
      label: "GitLab",
      provider: null,
      token: "Create a personal access token with the write_repository scope",
    },
  );
  return { component, close };
}

describe("GitCredentialDialogComponent", () => {
  it("hands git the typed name and token, the name trimmed and the token as it is", () => {
    const { component, close } = setup();
    component.name.set(" me ");
    component.secret.set(" glpat-token ");

    component.useTyped();

    expect(close).toHaveBeenCalledWith({
      kind: "typed",
      username: "me",
      password: " glpat-token ",
    });
  });

  it("does not answer git without a token", () => {
    const { component, close } = setup();
    component.name.set("me");

    component.useTyped();

    expect(close).not.toHaveBeenCalled();
  });
});
