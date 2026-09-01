import { TerminalAutocompleteSuggestorContract } from "@cogno/shared/contributions";
import { ShellTypeContract } from "@cogno/shared/domain";

export type AutocompleteSuggestorIssue = {
  readonly kind: "timeout" | "error";
  readonly suggestorId: string;
  readonly message: string;
  readonly input: string;
  readonly terminalId?: string;
};

/**
 * Where the suggestors that features contribute come from, and who hears
 * when one of them fails. The session asks; wiring the features together
 * and telling the user is done above the session (ARCHITECTURE.md 3.1,
 * "sources are injected").
 */
export abstract class AutocompleteSuggestorSource {
  abstract getSharedSuggestors(): ReadonlyArray<TerminalAutocompleteSuggestorContract>;
  abstract preloadForShellIntegration(shellType: ShellTypeContract): void;
  abstract reportSuggestorIssue(issue: AutocompleteSuggestorIssue): void;
}
