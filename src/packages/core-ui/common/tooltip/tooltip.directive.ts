import { Directive, ElementRef, HostListener, Input, OnDestroy } from "@angular/core";

@Directive({
  selector: "[appTooltip]",
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  @Input("appTooltip") text = "";
  @Input("appTooltipSecondary") secondaryText: string | undefined = undefined;
  @Input() tooltipDelay = 800;

  private tooltipElement?: HTMLElement;
  private showTimeout?: ReturnType<typeof setTimeout>;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  @HostListener("mouseenter")
  onMouseEnter(): void {
    this.showTimeout = setTimeout(() => {
      this.showTooltip();
    }, this.tooltipDelay);
  }

  @HostListener("mouseleave")
  onMouseLeave(): void {
    clearTimeout(this.showTimeout);
    this.removeTooltip();
  }

  ngOnDestroy(): void {
    clearTimeout(this.showTimeout);
    this.removeTooltip();
  }

  private showTooltip(): void {
    this.removeTooltip();
    if (!this.text) return;

    this.tooltipElement = document.createElement("div");
    const textElement = document.createElement("span");
    textElement.innerText = this.text;
    this.tooltipElement.appendChild(textElement);

    if (this.secondaryText) {
      const secondaryTextElement = document.createElement("span");
      secondaryTextElement.style.opacity = "0.5";
      secondaryTextElement.innerText = this.secondaryText;
      this.tooltipElement.appendChild(secondaryTextElement);
    }

    this.tooltipElement.style.display = "flex";
    this.tooltipElement.style.flexDirection = "row";
    this.tooltipElement.style.gap = "1rem";
    this.tooltipElement.style.position = "fixed";
    this.tooltipElement.style.padding = "3px 10px";
    this.tooltipElement.style.background = "var(--background-color-ct)";
    this.tooltipElement.style.color = "var(--foreground-color)";
    this.tooltipElement.style.borderRadius = "4px";
    this.tooltipElement.style.fontSize = "1rem";
    this.tooltipElement.style.zIndex = "9999";
    this.tooltipElement.style.pointerEvents = "none";
    this.tooltipElement.style.whiteSpace = "nowrap";
    this.tooltipElement.style.transition = "opacity 120ms ease";
    this.tooltipElement.style.opacity = "0";

    document.body.appendChild(this.tooltipElement);
    this.positionTooltip();

    requestAnimationFrame(() => {
      if (this.tooltipElement) this.tooltipElement.style.opacity = "1";
    });
  }

  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const margin = 6;

    let top = hostRect.bottom + margin;
    if (top + tooltipRect.height > window.innerHeight) {
      top = hostRect.top - tooltipRect.height - margin;
    }

    let left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
    if (left < 0) left = margin;
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - margin;
    }

    this.tooltipElement.style.top = `${top}px`;
    this.tooltipElement.style.left = `${left}px`;
  }

  private removeTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = undefined;
    }
  }
}
