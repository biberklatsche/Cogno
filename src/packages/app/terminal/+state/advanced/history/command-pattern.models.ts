export type CommandToken = {
  value: string;
  rawValue: string;
  wasQuoted: boolean;
};

export type CommandTokenKind = "stable" | "variable";

export type ClassifiedCommandToken = CommandToken & {
  kind: CommandTokenKind;
};

export type CommandSignaturePart =
  | {
      kind: "stable";
      value: string;
    }
  | {
      kind: "slot";
      slotIndex: number;
    };

export type CommandSignature = {
  key: string;
  parts: CommandSignaturePart[];
};

export type CommandPatternSlotStatistics = {
  readonly slotIndex: number;
  readonly totalCount: number;
  readonly distinctValueCount: number;
  readonly topValue: string;
  readonly topValueCount: number;
};

export type LearnedCommandPattern = {
  readonly signature: CommandSignature;
  readonly totalCount: number;
  readonly stableTokenCount: number;
  readonly nonOptionStableTokenCount: number;
  readonly variableSlotCount: number;
  readonly lastSeenAt: number;
  readonly shownCount: number;
  readonly selectedCount: number;
  readonly lastShownAt?: number;
  readonly lastSelectedAt?: number;
  readonly slotStatistics: CommandPatternSlotStatistics[];
};

export type CommandPatternOccurrence = {
  readonly signature: CommandSignature;
  readonly patternText: string;
  readonly stableTokenCount: number;
  readonly nonOptionStableTokenCount: number;
  readonly variableSlotCount: number;
  readonly slotValues: ReadonlyArray<{
    readonly slotIndex: number;
    readonly value: string;
  }>;
};
