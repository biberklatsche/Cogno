import { DirectoryHistoryRow } from "@cogno/core/command-log/command-log.api";
import { tokenMatchQuality } from "../../token-match";
import { recencyDecay, safeAge, sat } from "./decay";

const DIR_SCORING = {
  weights: {
    text: 0.45,
    hitCount: 0.1,
    select: 0.2,
    visit: 0.15,
    recencyVisit: 0.06,
    recencySelect: 0.04,
  },
  saturation: {
    hitCount: 6,
    select: 10,
    visit: 14,
  },
  halfLifeMs: {
    visit: 7 * 24 * 60 * 60 * 1000,
    select: 5 * 24 * 60 * 60 * 1000,
  },
} as const;

export class HistoryDirectoryScorer {
  static scoreRow(row: DirectoryHistoryRow, tokens: string[], now: number): number | null {
    const pathLower = row.path.toLowerCase();
    const basenameLower = row.basename.toLowerCase();
    const pathParts = pathLower
      .split(/[\\/]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const candidates = [basenameLower, ...pathParts];

    const tokenQualities: number[] = [];
    let tokenHits = 0;
    for (const token of tokens) {
      let best = 0;
      for (const candidate of candidates) {
        best = Math.max(best, tokenMatchQuality(token, candidate));
      }
      if (best <= 0) {
        return null;
      }
      tokenQualities.push(best);
      tokenHits += HistoryDirectoryScorer.countOccurrences(pathLower, token);
    }

    const textScore =
      tokenQualities.length > 0
        ? tokenQualities.reduce((a, b) => a + b, 0) / tokenQualities.length
        : 0;
    const hitCountScore = sat(tokenHits, DIR_SCORING.saturation.hitCount);
    const selectScore = sat(row.selectCount, DIR_SCORING.saturation.select);
    const visitScore = sat(row.visitCount, DIR_SCORING.saturation.visit);
    const recencyVisitScore = recencyDecay(
      safeAge(now, row.lastVisitAt),
      DIR_SCORING.halfLifeMs.visit,
    );
    const recencySelectScore = recencyDecay(
      safeAge(now, row.lastSelectAt),
      DIR_SCORING.halfLifeMs.select,
    );

    return (
      100 *
      (DIR_SCORING.weights.text * textScore +
        DIR_SCORING.weights.hitCount * hitCountScore +
        DIR_SCORING.weights.select * selectScore +
        DIR_SCORING.weights.visit * visitScore +
        DIR_SCORING.weights.recencyVisit * recencyVisitScore +
        DIR_SCORING.weights.recencySelect * recencySelectScore)
    );
  }

  private static countOccurrences(haystack: string, needle: string): number {
    if (!needle) return 0;
    let count = 0;
    let idx = 0;
    while (idx <= haystack.length - needle.length) {
      const found = haystack.indexOf(needle, idx);
      if (found < 0) break;
      count++;
      idx = found + needle.length;
    }
    return count;
  }
}
