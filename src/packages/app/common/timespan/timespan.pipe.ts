import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timespan',
  standalone: true
})
export class TimespanPipe implements PipeTransform {

  transform(ms: number): string {
    return timespan(ms);
  }
}

export function timespan(ms: number): string {
    if(!ms) return "";
    const parts: string[] = [];
    const hours = Math.floor(ms / 3600000);
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    ms %= 3600000;

    const minutes = Math.floor(ms / 60000);
    if (minutes > 0) {
        parts.push(`${minutes}m`);
    }
    ms %= 60000;

    const seconds = Math.floor(ms / 1000);
    if (seconds > 0) {
        parts.push(`${seconds}s`);
    }

    const milliseconds = ms % 1000;
    if (milliseconds > 0) {
        parts.push(`${milliseconds}ms`);
    }
    if(parts.length > 2) {
        parts.splice(2);
        parts.unshift('~');
    }
    return parts.join(" ");
}
