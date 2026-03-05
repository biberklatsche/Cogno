import { CommandHistoryRow } from "../../../history/history.repository";

const SCORING = {
    weights: {
        text: 0.40,
        cwd: 0.20,
        select: 0.18,
        exec: 0.10,
        recencySelect: 0.07,
        recencyExec: 0.05,
    },
    saturation: {
        cwd: 8,
        select: 10,
        exec: 20,
    },
    halfLifeMs: {
        select: 3 * 24 * 60 * 60 * 1000,
        exec: 7 * 24 * 60 * 60 * 1000,
    },
    sameCommandBonus: 8,
} as const;

export class HistoryCommandScorer {
    static firstToken(input: string): string {
        const trimmed = input.trim();
        if (!trimmed) return "";
        const idx = trimmed.search(/\s/);
        return (idx === -1 ? trimmed : trimmed.slice(0, idx)).toLowerCase();
    }

    static tokenizeWords(input: string): string[] {
        return input
            .toLowerCase()
            .trim()
            .split(/\s+/)
            .filter(Boolean);
    }

    static uniqueTokens(input: string): string[] {
        return Array.from(new Set(this.tokenizeWords(input)));
    }

    static buildDocFreq(rows: CommandHistoryRow[], queryTokens: string[]): Map<string, number> {
        const docFreq = new Map<string, number>();
        for (const token of queryTokens) {
            let df = 0;
            for (const row of rows) {
                const rowTokens = this.tokenizeWords(row.command);
                if (rowTokens.some(t => this.tokenMatchQuality(token, t) > 0)) df++;
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
        now: number
    ): number | null {
        const rowTokens = this.tokenizeWords(row.command);
        const textContrib: number[] = [];
        for (const token of queryTokens) {
            let bestQuality = 0;
            for (const rowToken of rowTokens) {
                bestQuality = Math.max(bestQuality, this.tokenMatchQuality(token, rowToken));
            }
            if (bestQuality <= 0) {
                return null;
            }
            const df = docFreq.get(token) ?? 0;
            const idf = Math.log(1 + (corpusSize - df + 0.5) / (df + 0.5));
            textContrib.push(bestQuality * idf);
        }

        const idfSum = queryTokens.reduce((sum, token) => {
            const df = docFreq.get(token) ?? 0;
            return sum + Math.log(1 + (corpusSize - df + 0.5) / (df + 0.5));
        }, 0);
        const textScore = idfSum > 0 ? Math.min(1, textContrib.reduce((a, b) => a + b, 0) / idfSum) : 0;
        const cwdScore = this.sat(row.cwdExecCount + (1.5 * row.cwdSelectCount), SCORING.saturation.cwd);
        const selectScore = this.sat(row.selectCount, SCORING.saturation.select);
        const execScore = this.sat(row.execCount, SCORING.saturation.exec);
        const recencySelectScore = this.recencyDecay(
            this.safeAge(now, row.lastSelectAt || row.cwdLastSelectAt),
            SCORING.halfLifeMs.select
        );
        const recencyExecScore = this.recencyDecay(
            this.safeAge(now, row.lastExecAt || row.cwdLastExecAt),
            SCORING.halfLifeMs.exec
        );
        const blended =
            (SCORING.weights.text * textScore) +
            (SCORING.weights.cwd * cwdScore) +
            (SCORING.weights.select * selectScore) +
            (SCORING.weights.exec * execScore) +
            (SCORING.weights.recencySelect * recencySelectScore) +
            (SCORING.weights.recencyExec * recencyExecScore);

        const rowCommandToken = this.firstToken(row.command);
        const sameCommandBonus = (!!inputCommandToken && rowCommandToken === inputCommandToken)
            ? SCORING.sameCommandBonus
            : 0;
        return (100 * blended) + sameCommandBonus;
    }

    private static tokenMatchQuality(queryToken: string, commandToken: string): number {
        if (!queryToken || !commandToken) return 0;
        if (commandToken.startsWith(queryToken)) return 1.0;
        if (commandToken.includes(queryToken)) return 0.7;
        if (this.isSubsequence(queryToken, commandToken)) return 0.5;
        return 0;
    }

    private static isSubsequence(needle: string, haystack: string): boolean {
        let j = 0;
        for (let i = 0; i < haystack.length && j < needle.length; i++) {
            if (haystack[i] === needle[j]) j++;
        }
        return j === needle.length;
    }

    private static sat(value: number, k: number): number {
        if (value <= 0) return 0;
        return value / (value + k);
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
