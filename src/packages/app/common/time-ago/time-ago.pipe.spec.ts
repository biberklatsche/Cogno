import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimeAgoPipe } from "./time-ago.pipe";

describe("TimeAgoPipe", () => {
    let pipe: TimeAgoPipe;
    const now = Date.now();

    beforeEach(() => {
        vi.setSystemTime(now);
        pipe = new TimeAgoPipe();
    });

    it('returns "now" for times less than 60 seconds ago', () => {
        expect(pipe.transform(new Date(now - 30_000))).toBe("now");
    });

    it('returns "1 minute ago" for times between 60 and 90 seconds ago', () => {
        expect(pipe.transform(new Date(now - 75_000))).toBe("1 minute ago");
    });

    it("returns rounded hours", () => {
        expect(pipe.transform(new Date(now - (10 * 3_600_000) - 1_000))).toBe("10 hours ago");
    });

    it("returns rounded years", () => {
        expect(pipe.transform(new Date(now - (2 * 365 * 24 * 3_600_000) - 1_000))).toBe("2 years ago");
    });
});
