export type HistoryScope = "global" | "cwd" | "session";

export type HistoryEntryOrigin = "session" | "cwd";

export type HistoryEntry = {
  command: string;
  executedAt: number;
  origin?: HistoryEntryOrigin;
};

export type TerminalHistoryViewState = {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  placement: "below" | "above";
  selectedIndex: number | null;
  entries: HistoryEntry[];
  scope: HistoryScope;
};
