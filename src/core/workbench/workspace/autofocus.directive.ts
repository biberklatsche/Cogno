import { Directive, ElementRef, effect, input, signal } from "@angular/core";

@Directive({
  selector: "[appAutofocus]",
  standalone: true,
})
export class AutofocusDirective {
  /** activates the focus */
  appAutofocus = input<boolean>(false);

  // prevents constant refocusing (only on false -> true)
  private wasEnabled = signal(false);

  constructor(private readonly inputElementReference: ElementRef<HTMLInputElement>) {
    effect(() => {
      const enabled = this.appAutofocus();
      const shouldFocusNow = enabled && !this.wasEnabled();

      this.wasEnabled.set(enabled);

      if (!shouldFocusNow) return;

      setTimeout(() => {
        const inputEl = this.inputElementReference.nativeElement;

        inputEl.focus();
        inputEl.select(); // optional, can be removed
      }, 20);
    });
  }
}
