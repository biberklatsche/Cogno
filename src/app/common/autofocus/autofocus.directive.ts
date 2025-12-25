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

    /** aktiviert den Fokus */
    appAutofocus = input<boolean>(false);

    /**
     * wenn true: nach dem Fokus wird das Input value auf '' gesetzt
     * und ein input-event gefeuert (damit Angular / dein Handler es mitbekommt)
     */
    clearOnFocus = input<boolean>(false);

    // verhindert dauerndes Refocusen (nur bei false -> true)
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
                inputEl.select(); // optional, kannst du entfernen

                if (this.clearOnFocus()) {
                    inputEl.value = '';
                    // wichtig: damit (input)="..." getriggert wird und dein Service updatet
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                }
            },20);
        });
    }
}
