import { AfterViewInit, Directive, ElementRef, OnDestroy, input } from "@angular/core";

@Directive({
    selector: "[appStartEllipsis]",
    standalone: true
})
export class StartEllipsisDirective implements AfterViewInit, OnDestroy {
    appStartEllipsis = input<string>("");

    private readonly prefix = "...";
    private resizeObserver?: ResizeObserver;

    constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

    ngAfterViewInit(): void {
        const element = this.elementRef.nativeElement;
        this.resizeObserver = new ResizeObserver(() => this.apply());
        this.resizeObserver.observe(element);
        queueMicrotask(() => this.apply());
    }

    ngOnDestroy(): void {
        this.resizeObserver?.disconnect();
    }

    ngDoCheck(): void {
        this.apply();
    }

    private apply(): void {
        const element = this.elementRef.nativeElement;
        const fullText = this.appStartEllipsis() ?? "";

        if (element.textContent !== fullText) {
            element.textContent = fullText;
        }

        if (element.scrollWidth <= element.clientWidth) return;

        let low = 0;
        let high = fullText.length;

        while (low < high) {
            const mid = Math.floor((low + high + 1) / 2);
            const candidate = this.prefix + fullText.slice(fullText.length - mid);
            element.textContent = candidate;
            if (element.scrollWidth <= element.clientWidth) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        element.textContent = low > 0
            ? this.prefix + fullText.slice(fullText.length - low)
            : this.prefix;
    }
}
