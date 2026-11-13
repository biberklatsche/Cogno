import { TerminalExitContract } from "@cogno/platform";

/**
 * Whether the end of a pane's shell closes the pane. Only what the user did
 * closes it: the shell ended by itself (`exit` was typed), or the user hung up
 * on the machine it runs on. Every other end leaves the pane where it is, and
 * it says what happened.
 */
export function closesPane(exit: TerminalExitContract): boolean {
  return exit.kind === "exited" || exit.kind === "hungUp";
}
