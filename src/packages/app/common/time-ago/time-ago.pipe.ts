import { Pipe, PipeTransform } from "@angular/core";
import { formatTimeAgo } from "@cogno/core-support";

@Pipe({
  name: "timeAgo",
  pure: true,
  standalone: true,
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: Date | string | number): string {
    return formatTimeAgo(value);
  }
}
