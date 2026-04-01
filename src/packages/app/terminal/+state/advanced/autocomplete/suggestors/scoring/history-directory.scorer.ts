import { DirectoryHistoryRow } from "../../../history/history.repository";

const DIR_SCORING = {
    weights: {
        text: 0.45,
        hitCount: 0.10,
        select: 0.20,
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
            .map(t => t.trim())
            .filter(Boolean);
        const candidates = [basenameLower, ...pathParts];

        const tokenQualities: number[] = [];
        let tokenHits = 0;
        for (const token of tokens) {
            let best = 0;
            for (const candidate of candidates) {
                best = Math.max(best, this.tokenMatchQuality(token, candidate));
            }
            if (best <= 0) {
                return null;
            }
            tokenQualities.push(best);
            tokenHits += this.countOccurrences(pathLower, token);
        }

        const textScore = tokenQualities.length > 0
            ? tokenQualities.reduce((a, b) => a + b, 0) / tokenQualities.length
            : 0;
        const hitCountScore = this.sat(tokenHits, DIR_SCORING.saturation.hitCount);
        const selectScore = this.sat(row.selectCount, DIR_SCORING.saturation.select);
        const visitScore = this.sat(row.visitCount, DIR_SCORING.saturation.visit);
        const recencyVisitScore = this.recencyDecay(
            this.safeAge(now, row.lastVisitAt),
            DIR_SCORING.halfLifeMs.visit
        );
        const recencySelectScore = this.recencyDecay(
            this.safeAge(now, row.lastSelectAt),
            DIR_SCORING.halfLifeMs.select
        );

        return 100 * (
            (DIR_SCORING.weights.text * textScore) +
            (DIR_SCORING.weights.hitCount * hitCountScore) +
            (DIR_SCORING.weights.select * selectScore) +
            (DIR_SCORING.weights.visit * visitScore) +
            (DIR_SCORING.weights.recencyVisit * recencyVisitScore) +
            (DIR_SCORING.weights.recencySelect * recencySelectScore)
        );
    }

    private static tokenMatchQuality(queryToken: string, candidateToken: string): number {
        if (!queryToken || !candidateToken) return 0;
        if (candidateToken.startsWith(queryToken)) return 1.0;
        if (candidateToken.includes(queryToken)) return 0.7;
        if (this.isSubsequence(queryToken, candidateToken)) return 0.5;
        return 0;
    }

    private static isSubsequence(needle: string, haystack: string): boolean {
        let j = 0;
        for (let i = 0; i < haystack.length && j < needle.length; i++) {
            if (haystack[i] === needle[j]) j++;
        }
        return j === needle.length;
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

    private static sat(value: number, k: number): number {
        if (value <= 0) return 0;
        return value / (value + k);
    }

    private static safeAge(now: number, ts?: number): number {
        if (!ts || !Number.isFinite(ts) || ts <= 0) return Number.POSITIVE_INFINITY;
        return Math.max(0, now - ts);
    }

    private static recencyDecay(ageMs: number, halfLifeMs: number): number {
        if (!Number.isFinite(ageMs) || ageMs < 0 || halfLifeMs <= 0) return 0;
        return Math.exp(-Math.LN2 * (ageMs / halfLifeMs));
    }
}


