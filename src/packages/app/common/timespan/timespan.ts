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
