import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
} from "@angular/core";
import { RemoteHost } from "@cogno/core/api/remote-shells-port";
import { RemotePanelService } from "./remote-panel.service";

/** The form's fields, in the order they are shown. */
const HOST_FIELDS = [
  { key: "name", label: "Name", placeholder: "office" },
  { key: "destination", label: "Destination", placeholder: "user@host or an ssh alias" },
  { key: "command", label: "Command", placeholder: "" },
] as const;

type FieldKey = (typeof HOST_FIELDS)[number]["key"];

type FormValues = Record<FieldKey, string>;

/**
 * Adds a remote, or changes one (`host`). The command starts as the default
 * one, so it can be copied or changed; saved unchanged, the remote names
 * none and follows the default.
 */
@Component({
  selector: "app-remote-host-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="host-form" (submit)="save($event)">
      @for (field of fields; track field.key) {
        <label>
          <span>{{ field.label }}</span>
          <input
            type="text"
            spellcheck="false"
            autocomplete="off"
            [placeholder]="field.key === 'command' ? defaultCommand : field.placeholder"
            [value]="values()[field.key]"
            [disabled]="saving()"
            (input)="setField(field.key, $event)"
          />
        </label>
      }
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
export class RemoteHostFormComponent implements OnInit {
  /** The remote to change; left out to add one. */
  @Input() host?: RemoteHost;
  /** What ssh runs when the remote names no command. */
  @Input({ required: true }) defaultCommand!: string;
  /** Saved or cancelled. */
  @Output() readonly closed = new EventEmitter<void>();

  readonly fields = HOST_FIELDS;
  readonly values = signal<FormValues>({ name: "", destination: "", command: "" });
  readonly saving = signal(false);
  readonly error = signal<string | undefined>(undefined);

  constructor(private readonly panel: RemotePanelService) {}

  ngOnInit(): void {
    this.values.set({
      name: this.host?.name ?? "",
      destination: this.host?.destination ?? "",
      command: this.host?.command ?? this.defaultCommand,
    });
  }

  setField(field: FieldKey, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.values.update((values) => ({ ...values, [field]: value }));
    this.error.set(undefined);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(undefined);
    const { name, destination, command } = this.values();
    const ownCommand = command.trim();
    const error = await this.panel.saveHost(
      {
        name,
        destination,
        command: ownCommand === "" || ownCommand === this.defaultCommand ? undefined : ownCommand,
      },
      this.host?.name,
    );
    this.saving.set(false);
    if (error === undefined) {
      this.closed.emit();
    } else {
      this.error.set(error);
    }
  }
}
