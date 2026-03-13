import { Pipe, PipeTransform } from '@angular/core';
import { timespan } from './timespan';

@Pipe({
  name: 'timespan',
  standalone: true
})
export class TimespanPipe implements PipeTransform {

  transform(ms: number): string {
    return timespan(ms);
  }
}
