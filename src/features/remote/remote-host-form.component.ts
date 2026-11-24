import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
} from "@angular/core";
import { RemoteHost } from "@cogno/core/api/remote-shells-port";
import { RemotePanelService } from "./remote-panel.service";

/** Changes what a remote (`host`) is called here. */
@Component({
  selector: "app-remote-host-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="host-form" (submit)="save($event)">
      <label>
        <span>Name</span>
        <input
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="office"
          [value]="name()"
          [disabled]="saving()"
          (input)="setName($event)"
        />
      </label>
      @if (error(); as error) {
        <div class="failure">{{ error }}</div>
      }
      <div class="form-actions">
        <button type="button" class="button" [disabled]="saving()" (click)="closed.emit()">
          Cancel
        </button>
        <button type="submit" class="button" [disabled]="saving()">Save</button>
      </div>
    </form>
  `,
  styles: `
    .host-form {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-bottom: 8px;
      margin-bottom: 6px;
      border-bottom: 1px solid color-mix(in srgb, var(--foreground-color) 15%, transparent);
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    label span {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    input {
      min-width: 0;
      background: var(--background-color);
      color: var(--foreground-color);
      border: 1px solid color-mix(in srgb, var(--foreground-color) 20%, transparent);
      border-radius: var(--button-border-radius);
      padding: 0.3rem 0.4rem;
      font: inherit;
    }

    input:focus {
      outline: none;
      border-color: var(--highlight-color);
    }

    .failure {
      color: var(--color-red);
      font-size: 0.9rem;
      overflow-wrap: anywhere;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
  `,
})
export class RemoteHostFormComponent implements OnChanges {
  /** The remote to rename. */
  @Input({ required: true }) host!: RemoteHost;
  /** Saved or cancelled. */
  @Output() readonly closed = new EventEmitter<void>();

  readonly name = signal("");
  readonly saving = signal(false);
  readonly error = signal<string | undefined>(undefined);

  constructor(private readonly panel: RemotePanelService) {}

  /** The panel may switch the form to another remote while it is open. */
  ngOnChanges(): void {
    this.error.set(undefined);
    this.name.set(this.host.name);
  }

  setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
    this.error.set(undefined);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(undefined);
    const error = await this.panel.renameHost(this.host.id, this.name());
    this.saving.set(false);
    if (error === undefined) {
      this.closed.emit();
    } else {
      this.error.set(error);
    }
  }
}
