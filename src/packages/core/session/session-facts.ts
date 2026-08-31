import type { CommandMenuBlockRange } from "./decoration/command-menu-items";
import type { ExecutedCommand } from "./recorder/executed-command";

/**
 * What a session says about itself. Facts, not commands: a fact states what
 * happened in the session and leaves the consequence to whoever listens -
 * the workbench, a notification, a tab title (ARCHITECTURE.md 2.1, "Fakten,
 * keine Befehle"). The type test next to this file keeps the union apart
 * from the workbench's actions.
 */
export type SessionFact =
  /** The shell reported its working directory, as the backend sees it. */
  | { readonly type: "cwdReported"; readonly cwd: string }
  /** A command started or finished. */
  | { readonly type: "busyChanged"; readonly isBusy: boolean }
  /** A command finished and the prompt told us how it went. */
  | { readonly type: "commandCompleted"; readonly command: ExecutedCommand }
  /** A new prompt was printed. */
  | { readonly type: "promptReported" }
  /** The user asked, from a command's marker menu, to see only that block. */
  | { readonly type: "filterBlockRequested"; readonly range: CommandMenuBlockRange }
  /** A program set the terminal title (OSC 2). */
  | { readonly type: "titleChanged"; readonly oscCode: 2; readonly title: string }
  /** A program asked for the user's attention (OSC 9). */
  | { readonly type: "notificationRequested"; readonly message: string }
  /** A full-screen program took over the terminal, or gave it back. */
  | { readonly type: "fullScreenChanged"; readonly active: boolean }
  /** The padding around the terminal was removed or restored; the usable area changed. */
  | { readonly type: "paddingChanged"; readonly removed: boolean };
