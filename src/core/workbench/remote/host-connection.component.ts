import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

/** How far the connection a pane waits for has come. */
export type HostConnectionState =
  | { readonly status: "connecting" }
  | { readonly status: "failed"; readonly reason: string };

/**
 * What a pane shows instead of a terminal while the machine its shell runs
 * on is not connected yet, or could not be.
 */
@Component({
  selector: "app-host-connection",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state(); as state) {
      @if (state.status === "connecting") {
        <div class="host-connection-title">Connecting to {{ host() }}…</div>
      } @else {
        <div class="host-connection-title">Could not connect to {{ host() }}</div>
        <div class="host-connection-reason">{{ state.reason }}</div>
        <div class="host-connection-actions">
          <button type="button" class="button" (click)="retry.emit()">Retry</button>
          <button type="button" class="button" (click)="closePane.emit()">Close</button>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      height: 100%;
      background: var(--background-color);
      color: var(--foreground-color);
    }
    .host-connection-title {
      font-weight: 600;
    }
    .host-connection-reason {
      opacity: 0.8;
      font-family: monospace;
      font-size: 0.85rem;
      max-width: 80%;
      text-align: center;
      white-space: pre-wrap;
    }
    .host-connection-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `,
})
export class HostConnectionComponent {
  host = input.required<string>();
  state = input.required<HostConnectionState>();
  retry = output<void>();
  closePane = output<void>();
}
