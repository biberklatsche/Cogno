import {
  Directive,
  ElementRef,
  effect,
  input,
  signal,
} from "@angular/core";

@Directive({
  selector: "[appTerminalSearchAutofocus]",
  standalone: true,
})
export class TerminalSearchAutofocusDirective {
  appTerminalSearchAutofocus = input<boolean>(false);
  clearOnFocus = input<boolean>(false);

  private readonly wasEnabledSignal = signal(false);

  constructor(private readonly inputElementReference: ElementRef<HTMLInputElement>) {
    effect(() => {
      const isEnabled = this.appTerminalSearchAutofocus();
      const shouldFocusNow = isEnabled && !this.wasEnabledSignal();
      this.wasEnabledSignal.set(isEnabled);

      if (!shouldFocusNow) {
        return;
      }

      setTimeout(() => {
        const inputElement = this.inputElementReference.nativeElement;
        inputElement.focus();
        inputElement.select();

        if (this.clearOnFocus()) {
          inputElement.value = "";
          inputElement.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, 20);
    });
  }
}
