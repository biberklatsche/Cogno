import { DialogRef } from "@cogno/shared/ui";
import { describe, expect, it, vi } from "vitest";
import {
  GitPromptDialogComponent,
  GitPromptDialogData,
  GitPromptResult,
} from "./git-prompt-dialog.component";

function setup(submit?: GitPromptDialogData["submit"]) {
  const close = vi.fn();
  const dialogRef = { close } as unknown as DialogRef<GitPromptResult>;
  const component = new GitPromptDialogComponent(dialogRef, {
    fields: [{ key: "url", label: "URL", value: " https://x/y.git ", required: true }],
    confirmLabel: "Clone",
    ...(submit ? { submit } : {}),
  });
  return { component, close };
}

describe("GitPromptDialogComponent", () => {
  it("closes with the trimmed values when there is nothing to run", async () => {
    const { component, close } = setup();

    await component.confirm();

    expect(close).toHaveBeenCalledWith({ values: { url: "https://x/y.git" } });
  });

  it("stays open while its work runs and closes once it succeeded", async () => {
    let finish: (ok: boolean) => void = () => {};
    const run = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    const { component, close } = setup({ run, label: () => "Cloning" });

    const confirmed = component.confirm();

    expect(run).toHaveBeenCalledWith({ url: "https://x/y.git" });
    expect(component.running()).toBe(true);
    expect(close).not.toHaveBeenCalled();

    finish(true);
    await confirmed;

    expect(component.running()).toBe(false);
    expect(close).toHaveBeenCalledWith({ values: { url: "https://x/y.git" } });
  });

  it("gives the form back when its work failed", async () => {
    const { component, close } = setup({ run: async () => false, label: () => "Cloning" });

    await component.confirm();

    expect(component.running()).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  it("does not start its work twice", async () => {
    let finish: (ok: boolean) => void = () => {};
    const run = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    const { component } = setup({ run, label: () => "Cloning" });

    const first = component.confirm();
    await component.confirm();
    finish(true);
    await first;

    expect(run).toHaveBeenCalledTimes(1);
  });
});
