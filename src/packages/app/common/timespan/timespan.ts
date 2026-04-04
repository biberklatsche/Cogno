export function timespan(milliseconds: number): string {
    if (!milliseconds) {
        return "";
    }

    const parts: string[] = [];
    let remainingMilliseconds = milliseconds;

    const hours = Math.floor(remainingMilliseconds / 3_600_000);
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    remainingMilliseconds %= 3_600_000;

    const minutes = Math.floor(remainingMilliseconds / 60_000);
    if (minutes > 0) {
        parts.push(`${minutes}m`);
    }
    remainingMilliseconds %= 60_000;

    const seconds = Math.floor(remainingMilliseconds / 1_000);
    if (seconds > 0) {
        parts.push(`${seconds}s`);
    }

    const millisecondsRemainder = remainingMilliseconds % 1_000;
    if (millisecondsRemainder > 0) {
        parts.push(`${millisecondsRemainder}ms`);
    }

    if (parts.length > 2) {
        parts.splice(2);
        parts.unshift("~");
    }

    return parts.join(" ");
}

const MINUTE_IN_MILLISECONDS = 60_000;
const HOUR_IN_MILLISECONDS = 3_600_000;
const DAY_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS;
const MONTH_IN_MILLISECONDS = Math.round(30.4 * DAY_IN_MILLISECONDS);
const YEAR_IN_MILLISECONDS = Math.round(365.25 * DAY_IN_MILLISECONDS);

export function formatTimeAgo(value: Date | string | number, now: number = Date.now()): string {
    const timestamp = normalizeTimestamp(value);
    if (timestamp === undefined) {
        return "";
    }

    const ageInMilliseconds = Math.max(0, Math.abs(now - timestamp));
    if (ageInMilliseconds < MINUTE_IN_MILLISECONDS) {
        return "now";
    }

    const ageInMinutes = Math.round(ageInMilliseconds / MINUTE_IN_MILLISECONDS);
    if (ageInMinutes < 60) {
        return `${ageInMinutes} minute${ageInMinutes === 1 ? "" : "s"} ago`;
    }

    const ageInHours = Math.round(ageInMilliseconds / HOUR_IN_MILLISECONDS);
    if (ageInHours < 24) {
        return `${ageInHours} hour${ageInHours === 1 ? "" : "s"} ago`;
    }

    const ageInDays = Math.round(ageInMilliseconds / DAY_IN_MILLISECONDS);
    if (ageInDays < 30) {
        return `${ageInDays} day${ageInDays === 1 ? "" : "s"} ago`;
    }

    const ageInMonths = Math.round(ageInMilliseconds / MONTH_IN_MILLISECONDS);
    if (ageInMonths < 12) {
        return `${ageInMonths} month${ageInMonths === 1 ? "" : "s"} ago`;
    }

    const ageInYears = Math.round(ageInMilliseconds / YEAR_IN_MILLISECONDS);
    return `${ageInYears} year${ageInYears === 1 ? "" : "s"} ago`;
}
function normalizeTimestamp(value: Date | string | number): number | undefined {
    const timestamp =
        value instanceof Date
            ? value.getTime()
            : typeof value === "string"
                ? new Date(value).getTime()
                : value;

    if (!Number.isFinite(timestamp)) {
        return undefined;
    }

    return timestamp;
}


