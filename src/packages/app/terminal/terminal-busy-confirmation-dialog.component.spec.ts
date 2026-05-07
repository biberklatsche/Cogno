import { describe, expect, it, vi } from "vitest";
import type { DialogRef } from "../common/dialog";
import {
  TerminalBusyConfirmationDialogComponent,
  type TerminalBusyConfirmationDialogData,
} from "./terminal-busy-confirmation-dialog.component";

describe("TerminalBusyConfirmationDialogComponent", () => {
  it("formats the busy terminal count for singular and plural states", () => {
    const singularDialog = new TerminalBusyConfirmationDialogComponent(
      { close: vi.fn() } as unknown as DialogRef<boolean>,
      { actionLabel: "close all tabs", busyTerminalCount: 1 },
    );
    const pluralDialog = new TerminalBusyConfirmationDialogComponent(
      { close: vi.fn() } as unknown as DialogRef<boolean>,
      { actionLabel: "close all tabs", busyTerminalCount: 3 },
    );

    expect(singularDialog.busyTerminalCountText()).toBe("1 terminal is still busy");
    expect(pluralDialog.busyTerminalCountText()).toBe("3 terminals are still busy");
  });

  it("closes the dialog with explicit confirmation decisions", () => {
    const dialogRef = { close: vi.fn() } as unknown as DialogRef<boolean>;
    const data: TerminalBusyConfirmationDialogData = {
      actionLabel: "close all tabs",
      busyTerminalCount: 2,
    };
    const component = new TerminalBusyConfirmationDialogComponent(dialogRef, data);

    component.confirm();
    component.cancel();

    expect(dialogRef.close).toHaveBeenNthCalledWith(1, true);
    expect(dialogRef.close).toHaveBeenNthCalledWith(2, false);
  });
});
