import { NgStyle } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  signal,
  ViewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { TerminalSession } from "../../terminal.session";
import { ComposerViewState, TerminalComposerService } from "./terminal-composer.service";

const MIN_ROWS = 3;
const MAX_ROWS = 12;

const INITIAL_VIEW_STATE: ComposerViewState = {
  visible: false,
  x: 0,
  y: 0,
  width: 320,
  placement: "below",
  seedText: "",
  seedCursorIndex: 0,
};

@Component({
  selector: "app-terminal-composer",
  standalone: true,
  imports: [NgStyle],
  template: `
    @if (viewState().visible) {
      <div
        class="composer-panel"
        [ngStyle]="{
          left: viewState().x + 'px',
          top: viewState().y + 'px',
          width: viewState().width + 'px',
          transform: viewState().placement === 'above' ? 'translateY(-100%)' : 'none'
        }"
      >
        <textarea
          #editor
          class="composer-editor"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          [rows]="rows()"
          [value]="text()"
          (input)="onInput($event)"
          (keydown)="onKeydown($event)"
        ></textarea>
        <div class="composer-hints">
          <span class="composer-hints-label">Multiline Input</span>
          <div class="composer-hints-shortcuts">
            <span>Run <i>Enter</i></span>
            <span>Newline <i>Shift+Enter</i></span>
            <span>Insert <i>{{ insertOnlyKeyLabel }}</i></span>
            <span>Cancel <i>Esc</i></span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .composer-panel {
        position: fixed;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        background: var(--background-color);
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-radius: 8px;
        box-shadow: var(--shadow3);
        z-index: 110;
        padding: 4px;
      }

      .composer-editor {
        box-sizing: border-box;
        width: 100%;
        resize: none;
        border: none;
        outline: none;
        background: transparent;
        color: var(--foreground-color);
        font-family: var(--font-family);
        font-size: var(--font-size);
        line-height: 1.4;
        padding: 4px 6px;
        white-space: pre;
        overflow-x: auto;
      }

      .composer-hints {
        margin-top: 4px;
        padding: 6px 8px 4px;
        border-top: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        color: color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent);
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .composer-hints-shortcuts {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .composer-hints i {
        opacity: var(--opacity-strong);
        font-style: normal;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalComposerComponent {
  protected readonly viewState = toSignal(this.composer.viewState$, {
    initialValue: INITIAL_VIEW_STATE,
  });
  protected readonly text = signal("");
  protected readonly rows = computed(() => {
    const lines = this.text().split("\n").length;
    return Math.max(MIN_ROWS, Math.min(MAX_ROWS, lines + 1));
  });
  protected readonly insertOnlyKeyLabel = navigator.platform.toUpperCase().includes("MAC")
    ? "⌘+Enter"
    : "Ctrl+Enter";

  @ViewChild("editor") private editorRef?: ElementRef<HTMLTextAreaElement>;

  /**
   * Clicking anywhere outside cancels the composer without stealing the
   * focus back — the click target (another pane, the terminal) keeps it.
   */
  private readonly outsidePointerListener = (event: PointerEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".composer-panel")) return;
    this.composer.hide();
  };

  constructor(
    private readonly composer: TerminalComposerService,
    private readonly session: TerminalSession,
    destroyRef: DestroyRef,
  ) {
    effect(() => {
      const view = this.viewState();
      if (!view.visible) {
        document.removeEventListener("pointerdown", this.outsidePointerListener, true);
        return;
      }
      document.addEventListener("pointerdown", this.outsidePointerListener, true);
      this.text.set(view.seedText);
      // Focus after the panel rendered; place the caret where it was in the
      // prompt input.
      queueMicrotask(() => {
        const editor = this.editorRef?.nativeElement;
        if (!editor) return;
        editor.focus();
        editor.setSelectionRange(view.seedCursorIndex, view.seedCursorIndex);
      });
    });
    destroyRef.onDestroy(() => {
      document.removeEventListener("pointerdown", this.outsidePointerListener, true);
    });
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key !== "Enter") return;
    // Shift+Enter keeps the textarea default: insert a newline.
    if (event.shiftKey) return;

    event.preventDefault();
    event.stopPropagation();
    const insertOnly = event.metaKey || event.ctrlKey;
    this.composer.submit(this.text(), { insertOnly });
    this.session.focus();
  }

  private close(): void {
    this.composer.hide();
    this.session.focus();
  }
}
