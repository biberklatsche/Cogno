import { ChangeDetectionStrategy, Component, effect, input, signal } from "@angular/core";
import { TabId } from "@cogno/core/workbench/grid-layout";
import { TerminalId } from "@cogno/shared/domain";
import { KeyframeBarsComponent } from "@cogno/shared/ui";
import { BusyIndicatorService } from "./busy-indicator.service";

/**
 * The busy indicator of a pane or a tab: plays the animation registered with
 * the highest priority for that terminal, or for any terminal in that tab.
 */
@Component({
  selector: "app-busy-indicator",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KeyframeBarsComponent],
  template: `
    <app-keyframe-bars [keyframes]="keyframes()" [pauseInBackground]="pauseInBackground()" />
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
  `,
})
export class BusyIndicatorComponent {
  targetId = input.required<TerminalId | TabId>();
  targetKind = input.required<"terminal" | "tab">();
  pauseInBackground = input(false);

  protected readonly keyframes = signal<ReadonlyArray<number[][]> | undefined>(undefined);

  constructor(private readonly busyIndicatorService: BusyIndicatorService) {
    effect((onCleanup) => {
      const id = this.targetId();
      const registrations$ =
        this.targetKind() === "terminal"
          ? this.busyIndicatorService.forTerminal$(id)
          : this.busyIndicatorService.forTab$(id);

      const subscription = registrations$.subscribe((registrations) => {
        const top = registrations.reduce<(typeof registrations)[number] | undefined>(
          (best, registration) =>
            !best || registration.priority > best.priority ? registration : best,
          undefined,
        );
        this.keyframes.set(top?.keyframes);
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
