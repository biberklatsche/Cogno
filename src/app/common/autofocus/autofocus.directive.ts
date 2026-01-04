import {
    Directive,
    ElementRef,
    effect,
    inject,
    input,
    signal,
    afterNextRender,
} from '@angular/core';

@Directive({
    selector: '[appAutofocus]',
    standalone: true,
})
export class AutofocusDirective {
    private el = inject(ElementRef<HTMLInputElement>);

    /** activates the focus */
    appAutofocus = input<boolean>(false);

    /**
     * if true: after focus, the input value is set to ''
     * and an input event is fired (so Angular / your handler notices it)
     */
    clearOnFocus = input<boolean>(false);

    // prevents constant refocusing (only on false -> true)
    private wasEnabled = signal(false);

    constructor() {
        effect(() => {
            const enabled = this.appAutofocus();
            const shouldFocusNow = enabled && !this.wasEnabled();

            this.wasEnabled.set(enabled);

            if (!shouldFocusNow) return;

            setTimeout(() => {
                const inputEl = this.el.nativeElement;

                inputEl.focus();
                inputEl.select(); // optional, can be removed

                if (this.clearOnFocus()) {
                    inputEl.value = '';
                    // important: so that (input)="..." is triggered and your service updates
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                }
            },20);
        });
    }
}
