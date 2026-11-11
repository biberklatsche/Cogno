import type { SessionHost } from "@cogno/core/session/host/session-host";
import type { SessionFact } from "@cogno/core/session/session-facts";
import { DialogRef, type DialogService } from "@cogno/shared/ui";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionClipboardPrompt } from "./session-clipboard-prompt";

describe("SessionClipboardPrompt", () => {
  let facts: Subject<SessionFact>;
  let answerClipboardRead: ReturnType<typeof vi.fn>;
  let dialog: DialogRef<boolean>;
  let open: ReturnType<typeof vi.fn>;
  let prompt: SessionClipboardPrompt;

  beforeEach(() => {
    facts = new Subject();
    answerClipboardRead = vi.fn().mockResolvedValue(undefined);
    open = vi.fn(() => {
      dialog = new DialogRef<boolean>(1, () => undefined);
      return dialog;
    });
    prompt = new SessionClipboardPrompt(
      { facts$: facts, answerClipboardRead } as unknown as SessionHost,
      { open } as unknown as DialogService,
    );
  });

  it("asks when a program wants to read the clipboard and passes on the answer", async () => {
    facts.next({ type: "clipboardReadRequested" });
    expect(open).toHaveBeenCalledTimes(1);
    expect(answerClipboardRead).not.toHaveBeenCalled();

    dialog.close(true);

    await vi.waitFor(() => expect(answerClipboardRead).toHaveBeenCalledWith(true));
  });

  it("refuses when the dialog is dismissed", async () => {
    facts.next({ type: "clipboardReadRequested" });

    dialog.close();

    await vi.waitFor(() => expect(answerClipboardRead).toHaveBeenCalledWith(false));
  });

  it("closes an open question as refused when the session goes", async () => {
    facts.next({ type: "clipboardReadRequested" });

    prompt.dispose();

    await vi.waitFor(() => expect(answerClipboardRead).toHaveBeenCalledWith(false));
  });
});
