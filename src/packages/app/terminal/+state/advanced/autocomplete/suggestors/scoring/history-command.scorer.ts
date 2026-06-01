import { CommandHistoryRow } from "../../../history/history.repository";
import { tokenMatchQuality } from "../../token-match";

const SCORING = {
  weights: {
    text: 0.32,
    cwd: 0.26,
    select: 0.12,
    exec: 0.04,
    recencySelect: 0.06,
    recencyExec: 0.04,
    transitionProbability: 0.11,
    transitionCount: 0.03,
    transitionRecency: 0.02,
  },
  saturation: {
    cwd: 8,
    select: 10,
    exec: 20,
    transition: 5,
  },
  halfLifeMs: {
    select: 3 * 24 * 60 * 60 * 1000,
    exec: 7 * 24 * 60 * 60 * 1000,
    transition: 7 * 24 * 60 * 60 * 1000,
    cwd: 4 * 60 * 60 * 1000,
  },
  sameCommandBonus: 8,
  currentCwdBonus: 18,
  currentCwdSelectionBonus: 6,
  currentCwdRecencyBonus: 22,
  transitionPrior: 1,
} as const;

export class HistoryCommandScorer {
  static firstToken(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    const idx = trimmed.search(/\s/);
    return (idx === -1 ? trimmed : trimmed.slice(0, idx)).toLowerCase();
  }

  static tokenizeWords(input: string): string[] {
    return input.toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  static uniqueTokens(input: string): string[] {
    return Array.from(new Set(HistoryCommandScorer.tokenizeWords(input)));
  }

  static buildDocFreq(rows: CommandHistoryRow[], queryTokens: string[]): Map<string, number> {
    const docFreq = new Map<string, number>();
    for (const token of queryTokens) {
      let df = 0;
      for (const row of rows) {
        const rowTokens = HistoryCommandScorer.tokenizeWords(row.command);
        if (rowTokens.some((t) => tokenMatchQuality(token, t) > 0)) df++;
      }
      docFreq.set(token, df);
    }
    return docFreq;
  }

  static scoreRow(
    row: CommandHistoryRow,
    queryTokens: string[],
    docFreq: Map<string, number>,
    corpusSize: number,
    inputCommandToken: string,
    now: number,
  ): number | null {
    const rowTokens = HistoryCommandScorer.tokenizeWords(row.command);
    const textContrib: number[] = [];
    for (const token of queryTokens) {
      const matchQualities = rowTokens
        .map((rt) => tokenMatchQuality(token, rt))
        .filter((q) => q > 0)
        .sort((a, b) => b - a);
      if (matchQualities.length === 0) return null;
      // Best match gets full weight; each additional match contributes 30% of the previous.
      // This rewards commands where multiple tokens match the query (e.g. "terraform test" for "te").
      const combinedQuality = matchQualities.reduce((acc, q, i) => acc + q * 0.3 ** i, 0);
      const df = docFreq.get(token) ?? 0;
      const idf = Math.log(1 + (corpusSize - df + 0.5) / (df + 0.5));
      textContrib.push(combinedQuality * idf);
    }

    const idfSum = queryTokens.reduce((sum, token) => {
      const df = docFreq.get(token) ?? 0;
      return sum + Math.log(1 + (corpusSize - df + 0.5) / (df + 0.5));
    }, 0);
    // No upper cap — multi-match pushes textScore above 1.0, which is intentional.
    const textScore = idfSum > 0 ? textContrib.reduce((a, b) => a + b, 0) / idfSum : 0;
    const cwdScore = HistoryCommandScorer.sat(
      row.cwdExecCount + 1.5 * row.cwdSelectCount,
      SCORING.saturation.cwd,
    );
    const selectScore = HistoryCommandScorer.sat(row.selectCount, SCORING.saturation.select);
    const execScore = HistoryCommandScorer.sat(row.execCount, SCORING.saturation.exec);
    const recencySelectScore = Math.max(
      HistoryCommandScorer.recencyDecay(
        HistoryCommandScorer.safeAge(now, row.lastSelectAt),
        SCORING.halfLifeMs.select,
      ),
      HistoryCommandScorer.recencyDecay(
        HistoryCommandScorer.safeAge(now, row.cwdLastSelectAt),
        SCORING.halfLifeMs.select,
      ),
    );
    const recencyExecScore = Math.max(
      HistoryCommandScorer.recencyDecay(
        HistoryCommandScorer.safeAge(now, row.lastExecAt),
        SCORING.halfLifeMs.exec,
      ),
      HistoryCommandScorer.recencyDecay(
        HistoryCommandScorer.safeAge(now, row.cwdLastExecAt),
        SCORING.halfLifeMs.exec,
      ),
    );
    const transitionProbabilityScore = HistoryCommandScorer.transitionProbability(
      row.transitionCount,
      row.outgoingTransitionCount,
      corpusSize,
    );
    const transitionCountScore = HistoryCommandScorer.sat(
      row.transitionCount,
      SCORING.saturation.transition,
    );
    const transitionRecencyScore = HistoryCommandScorer.recencyDecay(
      HistoryCommandScorer.safeAge(now, row.lastTransitionAt),
      SCORING.halfLifeMs.transition,
    );
    const blended =
      SCORING.weights.text * textScore +
      SCORING.weights.cwd * cwdScore +
      SCORING.weights.select * selectScore +
      SCORING.weights.exec * execScore +
      SCORING.weights.recencySelect * recencySelectScore +
      SCORING.weights.recencyExec * recencyExecScore +
      SCORING.weights.transitionProbability * transitionProbabilityScore +
      SCORING.weights.transitionCount * transitionCountScore +
      SCORING.weights.transitionRecency * transitionRecencyScore;

    const rowCommandToken = HistoryCommandScorer.firstToken(row.command);
    const sameCommandBonus =
      inputCommandToken && rowCommandToken === inputCommandToken ? SCORING.sameCommandBonus : 0;
    const currentCwdRecency = Math.max(row.cwdLastSelectAt || 0, row.cwdLastExecAt || 0);
    const currentCwdRecencyBonus =
      row.cwdExecCount > 0
        ? SCORING.currentCwdRecencyBonus *
          HistoryCommandScorer.recencyDecay(
            HistoryCommandScorer.safeAge(now, currentCwdRecency),
            SCORING.halfLifeMs.cwd,
          )
        : 0;
    const currentCwdBonus = row.cwdExecCount > 0 ? SCORING.currentCwdBonus : 0;
    const currentCwdSelectionBonus = row.cwdSelectCount > 0 ? SCORING.currentCwdSelectionBonus : 0;

    return (
      100 * blended +
      sameCommandBonus +
      currentCwdBonus +
      currentCwdSelectionBonus +
      currentCwdRecencyBonus
    );
  }


  private static sat(value: number, k: number): number {
    if (value <= 0) return 0;
    return value / (value + k);
  }

  private static transitionProbability(
    transitionCount: number,
    outgoingTransitionCount: number,
    candidateCount: number,
  ): number {
    if (transitionCount <= 0 || outgoingTransitionCount <= 0 || candidateCount <= 0) {
      return 0;
    }

    const smoothingPrior = SCORING.transitionPrior;
    const smoothedNumerator = transitionCount + smoothingPrior;
    const smoothedDenominator = outgoingTransitionCount + smoothingPrior * candidateCount;
    if (smoothedDenominator <= 0) {
      return 0;
    }

    return smoothedNumerator / smoothedDenominator;
  }

  private static recencyDecay(ageMs: number, halfLifeMs: number): number {
    if (!Number.isFinite(ageMs) || ageMs < 0 || halfLifeMs <= 0) return 0;
    return Math.exp(-Math.LN2 * (ageMs / halfLifeMs));
  }

  private static safeAge(now: number, ts?: number): number {
    if (!ts || !Number.isFinite(ts) || ts <= 0) return Number.POSITIVE_INFINITY;
    return Math.max(0, now - ts);
  }
}
