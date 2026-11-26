import { DialogService } from "@cogno/shared/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitProcessPromptService } from "./git-process-prompt.service";
import type { GitRemoteAccessService } from "./git-remote-access.service";
import type { GitViewState } from "./git-view-state.service";
import { GitCredentialDialogComponent } from "./ui/git-credential-dialog.component";
import { GitProcessPromptDialogComponent } from "./ui/git-process-prompt-dialog.component";

describe("GitProcessPromptService", () => {
  let open: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;
  let openAccess: ReturnType<typeof vi.fn>;
  let answer: (result: unknown) => void;
  let service: GitProcessPromptService;

  beforeEach(() => {
    close = vi.fn();
    open = vi.fn(() => ({
      result: new Promise((resolve) => (answer = resolve)),
      close,
    }));
    openAccess = vi.fn();
    service = new GitProcessPromptService(
      { open } as unknown as DialogService,
      { open: openAccess } as unknown as GitRemoteAccessService,
      { hosts: () => ({ "git.firma.de": "gitlab" }) } as unknown as GitViewState,
    );
  });

  const request = (origin: string, closed = new AbortController()) => ({
    origin,
    closed: closed.signal,
  });

  it("asks for credentials of a host with what its provider says about tokens", async () => {
    const prompts = service.forRun();

    const answered = prompts.answers.credential?.(request("https://gitlab.com"));
    answer({ kind: "typed", username: "me", password: "token" });

    expect(await answered).toEqual({ kind: "typed", username: "me", password: "token" });
    expect(open).toHaveBeenCalledWith(
      GitCredentialDialogComponent,
      expect.objectContaining({
        title: "Sign in to gitlab.com",
        data: expect.objectContaining({
          origin: "https://gitlab.com",
          host: "gitlab.com",
          label: "GitLab",
          token: "Create a personal access token with the write_repository scope",
        }),
      }),
    );
    expect(prompts.refused()).toBe(false);
  });

  it("takes a host nobody owns for what the person said it is, without a browser sign-in", async () => {
    const answered = service.forRun().answers.credential?.(request("https://git.firma.de:8443"));
    answer(undefined);
    await answered;

    expect(open.mock.calls[0]?.[1].data).toEqual(
      expect.objectContaining({ host: "git.firma.de", label: "GitLab", provider: null }),
    );
  });

  it("refuses a dismissed request and remembers it for the run", async () => {
    const prompts = service.forRun();

    const answered = prompts.answers.credential?.(request("https://gitlab.com"));
    answer(undefined);

    expect(await answered).toBeNull();
    expect(prompts.refused()).toBe(true);
    expect(openAccess).not.toHaveBeenCalled();
    expect(service.forRun().refused()).toBe(false);
  });

  it("shows the other ways in when the person asks for them", async () => {
    const prompts = service.forRun();

    const answered = prompts.answers.credential?.(request("https://gitlab.com"));
    answer("other");

    expect(await answered).toBeNull();
    expect(openAccess).toHaveBeenCalledWith("https://gitlab.com");
    expect(prompts.refused()).toBe(true);
  });

  it("closes the dialog when git ended before it was answered", async () => {
    const closed = new AbortController();
    const prompts = service.forRun();

    const answered = prompts.answers.credential?.(request("https://gitlab.com", closed));
    closed.abort();
    answer(undefined);

    expect(await answered).toBeNull();
    expect(close).toHaveBeenCalled();
    expect(prompts.refused()).toBe(false);
  });

  it("shows what ssh asks as a prompt of its kind", async () => {
    const answered = service.forRun().answers.prompt?.({
      text: "Enter passphrase for key '/home/l/.ssh/id_ed25519': ",
      closed: new AbortController().signal,
    });
    answer("secret");

    expect(await answered).toBe("secret");
    expect(open).toHaveBeenCalledWith(
      GitProcessPromptDialogComponent,
      expect.objectContaining({ data: expect.objectContaining({ confirm: false }) }),
    );
  });

  it("remembers for the run which origin git reported its credential as rejected for", () => {
    const prompts = service.forRun();
    expect(prompts.rejectedFor()).toBeNull();

    prompts.answers.credentialRejected?.("https://gitlab.com");

    expect(prompts.rejectedFor()).toBe("https://gitlab.com");
    expect(service.forRun().rejectedFor()).toBeNull();
  });
});
